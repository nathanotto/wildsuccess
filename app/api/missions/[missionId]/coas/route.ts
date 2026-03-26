import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params

  const { data: coas, error } = await supabase
    .from('coas')
    .select('*, big_outcomes(name)')
    .eq('mission_id', missionId)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const coaIds = coas.map((c: { id: string }) => c.id)
  const none = ['__none__']

  // Factor links with relationship
  const { data: links } = await supabase
    .from('coa_factor_links')
    .select('coa_id, relationship')
    .in('coa_id', coaIds.length ? coaIds : none)

  const linkCounts: Record<string, number> = {}
  const aimsCounts: Record<string, number> = {}
  ;(links ?? []).forEach((l: { coa_id: string; relationship: string }) => {
    linkCounts[l.coa_id] = (linkCounts[l.coa_id] ?? 0) + 1
    if (l.relationship === 'aims_to_resolve') aimsCounts[l.coa_id] = (aimsCounts[l.coa_id] ?? 0) + 1
  })

  // Sub-missions
  const { data: subMissions } = await supabase
    .from('missions')
    .select('id, parent_coa_id')
    .in('parent_coa_id', coaIds.length ? coaIds : none)

  const subMissionMap: Record<string, string> = {}
  ;(subMissions ?? []).forEach(sm => {
    if (sm.parent_coa_id) subMissionMap[sm.parent_coa_id] = sm.id
  })

  // Resource counts
  const { data: resources } = await supabase
    .from('coa_resource_needs')
    .select('coa_id, status')
    .in('coa_id', coaIds.length ? coaIds : none)

  const resCounts: Record<string, number> = {}
  const resMetCounts: Record<string, number> = {}
  ;(resources ?? []).forEach((r: { coa_id: string; status: string }) => {
    resCounts[r.coa_id] = (resCounts[r.coa_id] ?? 0) + 1
    if (r.status === 'met') resMetCounts[r.coa_id] = (resMetCounts[r.coa_id] ?? 0) + 1
  })

  // Dependency counts
  const { data: deps } = await supabase
    .from('coa_dependencies')
    .select('coa_id')
    .in('coa_id', coaIds.length ? coaIds : none)

  const depCounts: Record<string, number> = {}
  ;(deps ?? []).forEach((d: { coa_id: string }) => {
    depCounts[d.coa_id] = (depCounts[d.coa_id] ?? 0) + 1
  })

  const result = coas.map((c: Record<string, unknown>) => ({
    ...c,
    big_outcome_name: (c.big_outcomes as { name: string } | null)?.name ?? null,
    big_outcomes: undefined,
    linked_factor_count: linkCounts[c.id as string] ?? 0,
    aims_to_resolve_count: aimsCounts[c.id as string] ?? 0,
    has_sub_mission: !!(subMissionMap[c.id as string]),
    sub_mission_id: subMissionMap[c.id as string] ?? null,
    resource_count: resCounts[c.id as string] ?? 0,
    resource_met_count: resMetCounts[c.id as string] ?? 0,
    dependency_count: depCounts[c.id as string] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const body = await request.json()
  const { action, outcome } = body

  const { data: existing } = await supabase
    .from('coas')
    .select('sort_order')
    .eq('mission_id', missionId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = existing?.length ? (existing[0].sort_order + 1) : 0

  const { data, error } = await supabase
    .from('coas')
    .insert({
      mission_id: missionId,
      user_id: user.id,
      action,
      outcome: outcome || null,
      sort_order: nextSort,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'coa_created',
    description: `COA created: ${action}${outcome ? ' IOT ' + outcome : ''}`,
    subject_type: 'coa',
    subject_id: data.id,
  })

  return NextResponse.json({
    ...data, linked_factor_count: 0, aims_to_resolve_count: 0,
    has_sub_mission: false, sub_mission_id: null, big_outcome_name: null,
    resource_count: 0, resource_met_count: 0, dependency_count: 0,
  }, { status: 201 })
}
