import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserToday } from '@/lib/timezone'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { placement, rawInput, cleanedName, date, time, endTime, duration, personId, activityId, timeType, valueIds } = body
  // placement: 'todo_today' | 'todo_date' | 'book_time' | 'log'

  if (!placement || !rawInput?.trim()) {
    return NextResponse.json({ error: 'placement and rawInput are required' }, { status: 400 })
  }

  const today = await getUserToday(supabase, user.id)
  const name = cleanedName || rawInput.trim()
  const resolvedValueIds = Array.isArray(valueIds) && valueIds.length > 0 ? valueIds : null

  let actionItem = null
  let logEntry = null

  if (placement === 'log') {
    const { data } = await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'logged',
      event_date: today,
      note: rawInput.trim(),
      value_ids: resolvedValueIds,
      metadata: { cleanedName: name, duration, timeType },
    }).select().single()
    logEntry = data

  } else if (placement === 'todo_today') {
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'committed',
      committed_date: today,
      time_type: timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: 9999,
      enrichment_status: 'none',
      activity_id: activityId ?? null,
      person_id: personId ?? null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'captured',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: resolvedValueIds,
    })

  } else if (placement === 'todo_date') {
    if (!date) return NextResponse.json({ error: 'date is required for todo_date' }, { status: 400 })
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'committed',
      committed_date: date,
      time_type: timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: 9999,
      enrichment_status: 'none',
      activity_id: activityId ?? null,
      person_id: personId ?? null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'captured',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: resolvedValueIds,
    })

  } else if (placement === 'book_time') {
    if (!date || !time) return NextResponse.json({ error: 'date and time are required for book_time' }, { status: 400 })

    let timeBlockId: string | null = null
    const { data: block } = await supabase.from('time_blocks').insert({
      user_id: user.id,
      block_date: date,
      label: name,
      start_time: time,
      end_time: endTime ?? null,
      source: 'manual',
      time_type: timeType ?? 'B',
    }).select('id').single()
    timeBlockId = block?.id ?? null

    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'committed',
      committed_date: date,
      scheduled_time: time,
      scheduled_end_time: endTime ?? null,
      time_block_id: timeBlockId,
      flexibility: 'soft_scheduled',
      item_type: 'task',
      time_type: timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: 0,
      enrichment_status: 'none',
      activity_id: activityId ?? null,
      person_id: personId ?? null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'scheduled',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: resolvedValueIds,
    })
  }

  // Increment mention count for matched person
  if (personId) {
    const { data: personRow } = await supabase.from('known_people').select('mention_count').eq('id', personId).single()
    if (personRow) {
      await supabase.from('known_people').update({
        mention_count: (personRow.mention_count ?? 0) + 1,
        last_mentioned_at: new Date().toISOString(),
      }).eq('id', personId)
    }
  }

  return NextResponse.json({ actionItem, logEntry }, { status: 201 })
}
