import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, coaId } = await params
  const { target } = await request.json()

  // Get the COA
  const { data: coa, error: coaErr } = await supabase
    .from('coas')
    .select('*')
    .eq('id', coaId)
    .eq('user_id', user.id)
    .single()
  if (coaErr || !coa) return NextResponse.json({ error: 'COA not found' }, { status: 404 })

  if (target === 'big_outcome') {
    // Create Big Outcome from COA
    const { data: outcome, error: boErr } = await supabase
      .from('big_outcomes')
      .insert({
        user_id: user.id,
        name: coa.action,
        status: 'in_progress',
      })
      .select()
      .single()
    if (boErr) return NextResponse.json({ error: boErr.message }, { status: 500 })

    // Copy value links from parent mission
    const { data: missionValueLinks } = await supabase
      .from('mission_value_links')
      .select('value_id, contribution_strength')
      .eq('mission_id', missionId)

    if (missionValueLinks?.length) {
      await supabase.from('big_outcome_value_links').insert(
        missionValueLinks.map(l => ({
          user_id: user.id,
          big_outcome_id: outcome.id,
          value_id: l.value_id,
          contribution_strength: l.contribution_strength,
        }))
      )
    }

    // Link COA to Big Outcome and update status
    await supabase.from('coas').update({ big_outcome_id: outcome.id, status: 'committed' }).eq('id', coaId)

    await writeMissionLog(supabase, {
      mission_id: missionId, user_id: user.id,
      entry_type: 'coa_committed',
      description: `COA promoted to Big Outcome on Map: ${coa.action}`,
      subject_type: 'coa', subject_id: coaId,
    })

    return NextResponse.json({ outcome }, { status: 201 })

  } else if (target === 'hopper') {
    // Create action item from COA
    const { data: item, error: aiErr } = await supabase
      .from('action_items')
      .insert({
        user_id: user.id,
        name: coa.action,
        source: 'planning_function',
        item_type: 'task',
        status: 'candidate',
        coa_id: coaId,
        time_type: 'B',
        flexibility: 'anytime_this_week',
        emotional_weight: 'normal',
        bounding_type: 'action',
        priority_score: 50,
        priority_tier: 'normal',
        sort_order: 0,
      })
      .select()
      .single()
    if (aiErr) return NextResponse.json({ error: aiErr.message }, { status: 500 })

    // Update COA status
    await supabase.from('coas').update({ status: 'committed' }).eq('id', coaId)

    await writeMissionLog(supabase, {
      mission_id: missionId, user_id: user.id,
      entry_type: 'commitment_made',
      description: `COA sent to hopper: ${coa.action}`,
      subject_type: 'coa', subject_id: coaId,
    })

    return NextResponse.json({ action_item: item }, { status: 201 })

  } else if (target === 'sub_mission') {
    // Create sub-mission from COA
    const { data: mission, error: mErr } = await supabase
      .from('missions')
      .insert({
        user_id: user.id,
        name: coa.action,
        parent_coa_id: coaId,
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

    // Log on parent mission
    await writeMissionLog(supabase, {
      mission_id: missionId, user_id: user.id,
      entry_type: 'coa_committed',
      description: `Sub-mission created from COA: ${coa.action}`,
      subject_type: 'coa', subject_id: coaId,
    })

    // Log on the new child mission
    await writeMissionLog(supabase, {
      mission_id: mission.id, user_id: user.id,
      entry_type: 'mission_status_changed',
      description: `Mission created as sub-mission of parent plan`,
      subject_type: 'mission', subject_id: mission.id,
    })

    return NextResponse.json({ mission }, { status: 201 })

  } else {
    return NextResponse.json({ error: 'Invalid target. Use big_outcome, hopper, or sub_mission.' }, { status: 400 })
  }
}
