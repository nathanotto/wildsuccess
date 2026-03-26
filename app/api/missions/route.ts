import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // No user_id filter — RLS handles visibility (own missions + participated missions)
  const { data: missions, error } = await supabase
    .from('missions')
    .select('*, big_outcomes(name), coas!missions_parent_coa_id_fkey(action)')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get factor counts and accounted counts per mission
  const missionIds = missions.map((m: { id: string }) => m.id)

  const { data: factors } = await supabase
    .from('factors')
    .select('id, mission_id')
    .in('mission_id', missionIds.length ? missionIds : ['__none__'])

  const { data: links } = await supabase
    .from('coa_factor_links')
    .select('factor_id')

  const linkedFactorIds = new Set((links ?? []).map(l => l.factor_id))

  const { data: coas } = await supabase
    .from('coas')
    .select('id, mission_id, action')
    .in('mission_id', missionIds.length ? missionIds : ['__none__'])

  // Build COA id → mission_id map for parent lookups
  const coaToMission: Record<string, string> = {}
  ;(coas ?? []).forEach((c: { id: string; mission_id: string }) => { coaToMission[c.id] = c.mission_id })

  const result = missions.map((m: Record<string, unknown>) => {
    const mFactors = (factors ?? []).filter(f => f.mission_id === m.id)
    const accounted = mFactors.filter(f => linkedFactorIds.has(f.id)).length
    const mCoas = (coas ?? []).filter(c => c.mission_id === m.id)
    const parentCoaId = m.parent_coa_id as string | null
    return {
      ...m,
      big_outcome_name: (m.big_outcomes as { name: string } | null)?.name ?? null,
      parent_coa_name: (m.coas as { action: string } | null)?.action ?? null,
      parent_mission_id: parentCoaId ? (coaToMission[parentCoaId] ?? null) : null,
      big_outcomes: undefined,
      coas: undefined,
      factor_count: mFactors.length,
      accounted_factor_count: accounted,
      coa_count: mCoas.length,
    }
  })

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, is_public, big_outcome_id, value_links } = body

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
      user_id: user.id,
      name,
      description: description ?? null,
      is_public: is_public ?? false,
      big_outcome_id: big_outcome_id ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create participant row
  await supabase.from('mission_participants').insert({
    mission_id: mission.id,
    user_id: user.id,
    role: 'creator',
    accepted_at: new Date().toISOString(),
  })

  // Value links
  if (value_links?.length) {
    await supabase.from('mission_value_links').insert(
      value_links.map((l: { value_id: string; contribution_strength?: string }) => ({
        mission_id: mission.id,
        user_id: user.id,
        value_id: l.value_id,
        contribution_strength: l.contribution_strength ?? 'moderate',
      }))
    )
  }

  await writeMissionLog(supabase, {
    mission_id: mission.id,
    user_id: user.id,
    entry_type: 'mission_status_changed',
    description: `Mission created: ${name}`,
    subject_type: 'mission',
    subject_id: mission.id,
  })

  return NextResponse.json(mission, { status: 201 })
}
