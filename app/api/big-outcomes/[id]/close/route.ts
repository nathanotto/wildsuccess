import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { closure_type, closed_on, in_moment_note, successor } = body

  if (!closure_type) return NextResponse.json({ error: 'closure_type is required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const effectiveClosedOn = closed_on ?? today

  // 1. Load the Big Outcome
  const { data: bo, error: boError } = await supabase
    .from('big_outcomes')
    .select('*, big_outcome_value_links(value_id)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (boError || !bo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 2. Determine status from closure_type
  const statusMap: Record<string, string> = {
    accomplished: 'achieved',
    declared_complete: 'declared_complete',
    closed_with_succession: 'closed_with_succession',
    abandoned: 'abandoned',
  }
  const newStatus = statusMap[closure_type]
  if (!newStatus) return NextResponse.json({ error: 'Invalid closure_type' }, { status: 400 })

  // 3. If closed_with_succession, create the successor BO
  let successorBo = null
  if (closure_type === 'closed_with_succession' && successor?.name) {
    const { data: newBo, error: newBoError } = await supabase
      .from('big_outcomes')
      .insert({
        user_id: user.id,
        name: successor.name,
        description: successor.description ?? null,
        target_date: successor.target_date ?? null,
        status: 'in_progress',
        succeeds_big_outcome_id: id,
        sort_order: (bo.sort_order ?? 0) + 1,
      })
      .select()
      .single()

    if (newBoError) return NextResponse.json({ error: newBoError.message }, { status: 500 })
    successorBo = newBo

    // Update the closing BO to point to successor
    await supabase
      .from('big_outcomes')
      .update({ succeeded_by_big_outcome_id: newBo.id })
      .eq('id', id)
  }

  // 4. Update the Big Outcome
  const { data: updatedBo, error: updateError } = await supabase
    .from('big_outcomes')
    .update({
      status: newStatus,
      closure_type,
      closed_on: effectiveClosedOn,
      completed_at: new Date().toISOString(),
      ...(successorBo ? { succeeded_by_big_outcome_id: successorBo.id } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // 5. Create the marker
  const linkedValueIds = (bo.big_outcome_value_links ?? []).map((vl: { value_id: string }) => vl.value_id)

  const { data: marker, error: markerError } = await supabase
    .from('markers')
    .insert({
      user_id: user.id,
      occurred_on: effectiveClosedOn,
      subject_type: 'big_outcome',
      subject_id: id,
      subject_title_snapshot: bo.name,
      marker_type: closure_type,
      title: bo.name,
      in_moment_note: in_moment_note ?? null,
      linked_value_ids: linkedValueIds,
      ...(successorBo ? { succeeded_by_type: 'big_outcome', succeeded_by_id: successorBo.id } : {}),
    })
    .select()
    .single()

  if (markerError) return NextResponse.json({ error: markerError.message }, { status: 500 })

  // TODO: Cascade handling for linked COAs, missions, and action items is deferred to a later session.

  return NextResponse.json({
    big_outcome: updatedBo,
    successor_big_outcome: successorBo,
    marker,
  })
}
