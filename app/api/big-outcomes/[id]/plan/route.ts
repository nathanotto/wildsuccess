import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: bigOutcomeId } = await params

  // Check the Big Outcome exists and belongs to user
  const { data: bo, error: boErr } = await supabase
    .from('big_outcomes')
    .select('id, name')
    .eq('id', bigOutcomeId)
    .eq('user_id', user.id)
    .single()
  if (boErr || !bo) return NextResponse.json({ error: 'Big Outcome not found' }, { status: 404 })

  // Check no mission already linked
  const { data: existing } = await supabase
    .from('missions')
    .select('id')
    .eq('big_outcome_id', bigOutcomeId)
    .limit(1)
  if (existing?.length) return NextResponse.json({ error: 'Mission already exists for this Big Outcome', mission_id: existing[0].id }, { status: 409 })

  // Create mission
  const { data: mission, error: mErr } = await supabase
    .from('missions')
    .insert({
      user_id: user.id,
      name: bo.name,
      big_outcome_id: bigOutcomeId,
      status: 'planning',
    })
    .select()
    .single()
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Auto-create participant
  await supabase.from('mission_participants').insert({
    mission_id: mission.id,
    user_id: user.id,
    role: 'creator',
    accepted_at: new Date().toISOString(),
  })

  // Copy value links from Big Outcome
  const { data: boLinks } = await supabase
    .from('big_outcome_value_links')
    .select('value_id, contribution_strength')
    .eq('big_outcome_id', bigOutcomeId)

  if (boLinks?.length) {
    await supabase.from('mission_value_links').insert(
      boLinks.map(l => ({
        mission_id: mission.id,
        user_id: user.id,
        value_id: l.value_id,
        contribution_strength: l.contribution_strength,
      }))
    )
  }

  await writeMissionLog(supabase, {
    mission_id: mission.id,
    user_id: user.id,
    entry_type: 'mission_status_changed',
    description: `Mission created from Big Outcome: ${bo.name}`,
    subject_type: 'mission',
    subject_id: mission.id,
  })

  return NextResponse.json({ mission_id: mission.id }, { status: 201 })
}
