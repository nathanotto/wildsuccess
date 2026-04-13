import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserToday } from '@/lib/timezone'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, ...extra } = body

  const validStatuses = [
    'candidate', 'committed', 'in_progress', 'completed',
    'parked', 'skipped', 'rescheduled', 'dismissed', 'archived',
  ]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Fetch current item
  const { data: current, error: fetchError } = await supabase
    .from('action_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const today = await getUserToday(supabase, user.id)
  const update: Record<string, unknown> = { status }

  const isReopening = status === 'committed' && (current.status === 'completed' || current.status === 'skipped')

  // ── Status-specific field updates ──

  if (status === 'committed' && !isReopening) {
    update.committed_date = extra.committed_date ?? today
    update.committed_at = now.toISOString()
    // Reset dismissals when committing from a suggestion
    if (current.task_suggestion_id) {
      update.consecutive_dismissals = 0
    }
  }

  if (status === 'completed') {
    update.completed_at = now.toISOString()
    update.completed_date = extra.view_date ?? today
  }

  if (status === 'parked') {
    if (!extra.parked_until) {
      const { localDateOffsetInTz, getUserTimezone } = await import('@/lib/timezone')
      const tz = await getUserTimezone(supabase, user.id)
      update.parked_until = localDateOffsetInTz(tz, 1)
    } else {
      update.parked_until = extra.parked_until
    }
  }

  if (status === 'candidate') {
    // Send back to candidate — clear scheduling fields
    update.committed_date = null
    update.scheduled_time = null
    update.scheduled_end_time = null
    update.time_block_id = null
    update.committed_at = null
  }

  if (status === 'rescheduled') {
    // Clear scheduling fields so the old time_block becomes orphan-safe
    // and delete the old time_block to prevent orphan reconciliation from creating duplicates
    if (current.time_block_id) {
      await supabase.from('time_blocks').delete().eq('id', current.time_block_id)
    }
    update.scheduled_time = null
    update.scheduled_end_time = null
    update.time_block_id = null
    // Move back to candidate so it lands in the hopper
    update.status = 'candidate'
    update.committed_date = null
    update.committed_at = null
  }

  if (status === 'dismissed' && current.task_suggestion_id) {
    // Increment consecutive_dismissals on the task_suggestion
    await supabase.rpc('increment_field', {
      table_name: 'task_suggestions',
      field_name: 'consecutive_dismissals',
      row_id: current.task_suggestion_id,
    }).then(async (rpcResult) => {
      // Fallback: if RPC doesn't exist, do a manual read-then-write
      if (rpcResult.error) {
        const { data: ts } = await supabase
          .from('task_suggestions')
          .select('consecutive_dismissals')
          .eq('id', current.task_suggestion_id)
          .eq('user_id', user.id)
          .single()
        if (ts) {
          await supabase
            .from('task_suggestions')
            .update({ consecutive_dismissals: (ts.consecutive_dismissals ?? 0) + 1 })
            .eq('id', current.task_suggestion_id)
            .eq('user_id', user.id)
        }
      }
    })
  }

  // ── Reopening from completed → committed ──

  if (isReopening) {
    update.completed_at = null
    update.completed_date = null
    update.committed_date = extra.committed_date ?? current.committed_date ?? today
    update.committed_at = now.toISOString()

    if (current.task_suggestion_id && current.completed_at) {
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
  }

  // ── Perform the update ──

  const { data: updated, error: updateError } = await supabase
    .from('action_items')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // ── Task suggestion side-effects ──

  if (status === 'completed' && current.task_suggestion_id) {
    await supabase
      .from('task_suggestions')
      .update({ last_completed_at: now.toISOString(), consecutive_dismissals: 0 })
      .eq('id', current.task_suggestion_id)
      .eq('user_id', user.id)
  }

  // ── Action log ──

  const eventTypeMap: Record<string, string> = {
    committed: 'committed',
    in_progress: 'in_progress',
    completed: 'completed',
    skipped: 'skipped',
    parked: 'parked',
    candidate: 'rescheduled',
    dismissed: 'dismissed',
    archived: 'archived',
  }
  const eventType = isReopening ? 'reopened' : eventTypeMap[status]

  if (eventType) {
    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: eventType,
      action_item_id: id,
      activity_id: current.activity_id ?? null,
      task_suggestion_id: current.task_suggestion_id ?? null,
      event_date: extra.view_date ?? today,
    })
  }

  return NextResponse.json({ item: updated })
}
