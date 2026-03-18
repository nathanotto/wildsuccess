import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { status } = await req.json()

  const validStatuses = ['active', 'in_progress', 'completed', 'skipped', 'rescheduled', 'parked']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Fetch the current item to get task_suggestion_id and current status
  const { data: current, error: fetchError } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const update: Record<string, unknown> = { status }

  if (status === 'completed') {
    update.completed_at = now.toISOString()
  } else if (status === 'active') {
    // Reopening: clear completion fields
    update.completed_at = null
  } else if (status === 'parked') {
    // Set parked_until to tomorrow
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    update.parked_until = tomorrow.toISOString().split('T')[0]
  } else if (status === 'rescheduled') {
    // Will be handled below — create hopper_item and remove from today
  }

  const { data: updated, error: updateError } = await supabase
    .from('schedule_items')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Map status → event_type for action_log
  const eventTypeMap: Record<string, string> = {
    in_progress: 'in_progress',
    completed: 'completed',
    active: 'reopened',
    parked: 'parked',
    rescheduled: 'rescheduled',
    skipped: 'skipped',
  }
  const eventType = eventTypeMap[status]

  if (eventType) {
    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: eventType,
      schedule_item_id: id,
      activity_id: current.activity_id ?? null,
      hopper_item_id: current.hopper_item_id ?? null,
      task_suggestion_id: current.task_suggestion_id ?? null,
      event_date: today,
    })
  }

  // On completion: update task_suggestion.last_completed_at
  if (status === 'completed' && current.task_suggestion_id) {
    await supabase
      .from('task_suggestions')
      .update({ last_completed_at: now.toISOString(), consecutive_dismissals: 0 })
      .eq('id', current.task_suggestion_id)
      .eq('user_id', user.id)
  }

  // On reopen (active): clear task_suggestion.last_completed_at if this was the most recent
  if (status === 'active' && current.task_suggestion_id && current.completed_at) {
    const { data: ts } = await supabase
      .from('task_suggestions')
      .select('last_completed_at')
      .eq('id', current.task_suggestion_id)
      .eq('user_id', user.id)
      .single()
    if (ts && ts.last_completed_at === current.completed_at) {
      await supabase
        .from('task_suggestions')
        .update({ last_completed_at: null })
        .eq('id', current.task_suggestion_id)
        .eq('user_id', user.id)
    }
  }

  // On rescheduled: restore to the hopper.
  // If the schedule_item came from an existing hopper_item, revert it to pending.
  // Otherwise create a new hopper_item.
  let hopperItem = null
  if (status === 'rescheduled') {
    if (current.hopper_item_id) {
      // Revert the original hopper_item back to pending
      const { data: hi } = await supabase
        .from('hopper_items')
        .update({ status: 'pending', resolved_at: null })
        .eq('id', current.hopper_item_id)
        .eq('user_id', user.id)
        .select()
        .single()
      hopperItem = hi
    } else {
      const { data: hi } = await supabase
        .from('hopper_items')
        .insert({
          user_id: user.id,
          raw_input: current.name,
          source: 'quick_capture',
          activity_id: current.activity_id ?? null,
          task_suggestion_id: current.task_suggestion_id ?? null,
          status: 'pending',
          priority_score: 0,
          priority_tier: 'normal',
          bounding_type: current.bounding_type,
          time_type: current.time_type,
          enrichment_status: 'none',
          proposed_date: today,
        })
        .select()
        .single()
      hopperItem = hi
    }
  }

  return NextResponse.json({ item: updated, hopperItem })
}
