import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params

  // Get all COAs for this mission
  const { data: coas } = await supabase.from('coas').select('id, action').eq('mission_id', missionId)
  const coaIds = (coas ?? []).map(c => c.id)
  if (!coaIds.length) return NextResponse.json([])

  const { data, error } = await supabase
    .from('coa_dependencies')
    .select('*')
    .in('coa_id', coaIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join depends_on action text
  const coaMap = new Map((coas ?? []).map(c => [c.id, c.action]))
  const result = (data ?? []).map(d => ({
    ...d,
    depends_on_action: coaMap.get(d.depends_on_coa_id) ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const { coa_id, depends_on_coa_id, reason, is_hard } = await request.json()

  // Validate both COAs belong to this mission
  const { data: coas } = await supabase
    .from('coas')
    .select('id, action')
    .eq('mission_id', missionId)
    .in('id', [coa_id, depends_on_coa_id])
  if (!coas || coas.length < 2) return NextResponse.json({ error: 'Both COAs must belong to this mission' }, { status: 400 })

  // Prevent circular: check if depends_on_coa_id already depends on coa_id
  const { data: reverse } = await supabase
    .from('coa_dependencies')
    .select('id')
    .eq('coa_id', depends_on_coa_id)
    .eq('depends_on_coa_id', coa_id)
    .limit(1)
  if (reverse?.length) return NextResponse.json({ error: 'Circular dependency — the prerequisite already depends on this COA' }, { status: 400 })

  const { data, error } = await supabase
    .from('coa_dependencies')
    .insert({ coa_id, depends_on_coa_id, reason, is_hard: is_hard ?? false })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const coaMap = new Map(coas.map(c => [c.id, c.action]))
  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'dependency_added',
    description: `Dependency: "${coaMap.get(coa_id)}" depends on "${coaMap.get(depends_on_coa_id)}" because: ${reason}`,
    subject_type: 'dependency',
    subject_id: data.id,
  })

  return NextResponse.json({ ...data, depends_on_action: coaMap.get(depends_on_coa_id) }, { status: 201 })
}
