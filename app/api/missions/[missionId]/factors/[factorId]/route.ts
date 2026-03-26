import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function PATCH(request: Request, { params }: { params: Promise<{ missionId: string; factorId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, factorId } = await params
  const body = await request.json()

  // Get current factor
  const { data: current } = await supabase.from('factors').select('*').eq('id', factorId).single()

  const updateData: Record<string, unknown> = { ...body }

  // If resolving, set resolved_at
  if (body.status === 'resolved' && current?.status !== 'resolved') {
    updateData.resolved_at = new Date().toISOString()
  }

  // Remove non-column fields
  delete updateData.create_fact
  delete updateData.fact_text

  const { data, error } = await supabase
    .from('factors')
    .update(updateData)
    .eq('id', factorId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log resolution
  if (body.status === 'resolved' && current?.status !== 'resolved') {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'factor_resolved',
      description: `Factor resolved (${current.kind}): ${current.name}${body.resolution_note ? ' — ' + body.resolution_note : ''}`,
      subject_type: 'factor',
      subject_id: factorId,
    })
  }

  // If assumption confirmed → create fact
  let new_fact = null
  if (body.create_fact && body.fact_text) {
    const { data: existing } = await supabase
      .from('factors')
      .select('sort_order')
      .eq('mission_id', missionId)
      .eq('kind', 'fact')
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSort = existing?.length ? (existing[0].sort_order + 1) : 0

    const { data: factData } = await supabase
      .from('factors')
      .insert({
        mission_id: missionId,
        user_id: user.id,
        kind: 'fact',
        name: body.fact_text,
        sort_order: nextSort,
      })
      .select()
      .single()

    if (factData) {
      new_fact = factData
      await writeMissionLog(supabase, {
        mission_id: missionId,
        user_id: user.id,
        entry_type: 'factor_added',
        description: `Fact created from confirmed assumption: ${body.fact_text}`,
        subject_type: 'factor',
        subject_id: factData.id,
      })
    }
  }

  return NextResponse.json({ ...data, new_fact })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string; factorId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, factorId } = await params

  const { data: factor } = await supabase.from('factors').select('kind, name').eq('id', factorId).single()

  const { error } = await supabase.from('factors').delete().eq('id', factorId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (factor) {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'factor_invalidated',
      description: `Factor removed (${factor.kind}): ${factor.name}`,
      subject_type: 'factor',
      subject_id: factorId,
    })
  }

  return NextResponse.json({ success: true })
}
