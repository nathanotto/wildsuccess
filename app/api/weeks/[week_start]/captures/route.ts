import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserTimezone } from '@/lib/timezone'

type Params = { params: Promise<{ week_start: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { week_start } = await params
  const tz = await getUserTimezone(supabase, user.id)

  // Compute week range in the user's timezone
  const startLocal = new Date(`${week_start}T00:00:00`)
  const endDate = new Date(startLocal)
  endDate.setDate(endDate.getDate() + 7)
  const weekEndStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  const startISO = localMidnightToUTC(week_start, tz)
  const endISO = localMidnightToUTC(weekEndStr, tz)

  // Fetch all capture-like content in parallel
  const [actionItemsRes, notesRes, loggedRes, completedRes, completionsRes] = await Promise.all([
    // Action items created during the week — EXCLUDE system scaffolding
    supabase
      .from('action_items')
      .select('id, name, source, created_at')
      .eq('user_id', user.id)
      .not('source', 'in', '("template_proposal","calendar_import")')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true }),
    // Notes added during the week
    supabase
      .from('item_notes')
      .select('id, content, created_at, action_item_id')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true }),
    // Day log entries (user narrations) during the week
    supabase
      .from('action_log')
      .select('id, note, metadata, created_at')
      .eq('user_id', user.id)
      .eq('event_type', 'logged')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true }),
    // Completion events during the week — includes recurring activities
    // Join to action_items to get name, scheduled_time, committed_date
    supabase
      .from('action_log')
      .select('id, action_item_id, note, metadata, event_date, created_at')
      .eq('user_id', user.id)
      .eq('event_type', 'completed')
      .gte('event_date', week_start)
      .lt('event_date', weekEndStr)
      .order('event_date', { ascending: true }),
    // Day completion reflections during the week
    supabase
      .from('day_completions')
      .select('id, completion_date, wins, friction, journal, completed_at')
      .eq('user_id', user.id)
      .gte('completion_date', week_start)
      .lt('completion_date', weekEndStr)
      .order('completion_date', { ascending: true }),
  ])

  // For completion events, fetch the linked action_items to get scheduled_time and committed_date
  const completedLogs = completedRes.data ?? []
  const completedItemIds = [...new Set(completedLogs.map(l => l.action_item_id).filter(Boolean))]
  let completedItemsMap: Record<string, { name: string; scheduled_time: string | null; committed_date: string | null }> = {}
  if (completedItemIds.length > 0) {
    const { data: items } = await supabase
      .from('action_items')
      .select('id, name, scheduled_time, committed_date')
      .in('id', completedItemIds)
    for (const item of items ?? []) {
      completedItemsMap[item.id] = { name: item.name, scheduled_time: item.scheduled_time, committed_date: item.committed_date }
    }
  }

  const stream: Array<{
    timestamp: string
    type: 'action_item' | 'note' | 'day_log' | 'reflection' | 'capture' | 'completed'
    text: string
    source_id: string
  }> = []

  // Action items (user-created only — template_proposal and calendar_import excluded by query)
  for (const item of actionItemsRes.data ?? []) {
    stream.push({
      timestamp: item.created_at,
      type: 'action_item',
      text: item.name,
      source_id: item.id,
    })
  }

  // Notes
  for (const note of notesRes.data ?? []) {
    stream.push({
      timestamp: note.created_at,
      type: 'note',
      text: note.content,
      source_id: note.id,
    })
  }

  // Day logs (user narrations)
  for (const log of loggedRes.data ?? []) {
    const text = (log.metadata as Record<string, unknown> | null)?.cleanedName as string ?? log.note ?? ''
    if (text) {
      stream.push({
        timestamp: log.created_at,
        type: 'day_log',
        text,
        source_id: log.id,
      })
    }
  }

  // Completion events — use scheduled_time + committed_date as timestamp when available
  const seenCompletedItems = new Set<string>()
  for (const log of completedLogs) {
    const itemId = log.action_item_id
    if (!itemId) continue
    // Deduplicate: one completion entry per action_item (in case of duplicate logs)
    if (seenCompletedItems.has(itemId)) continue
    seenCompletedItems.add(itemId)

    const item = completedItemsMap[itemId]
    if (!item) continue

    // Don't duplicate items already shown as user-created action_items
    // (those show as 'action_item' type from the creation query)

    // Compute the "real" timestamp: when the activity actually happened
    let realTimestamp: string
    if (item.scheduled_time && item.committed_date) {
      // Scheduled item: use committed_date + scheduled_time as the real moment
      realTimestamp = `${item.committed_date}T${item.scheduled_time}`
    } else if (item.committed_date) {
      // Unscheduled but committed: use committed_date at noon as approximation
      realTimestamp = `${item.committed_date}T12:00:00`
    } else {
      // Fallback: when the user clicked done
      realTimestamp = log.created_at
    }

    stream.push({
      timestamp: realTimestamp,
      type: 'completed',
      text: item.name,
      source_id: log.id,
    })
  }

  // Day completion reflections
  for (const dc of completionsRes.data ?? []) {
    const parts: string[] = []
    if (dc.wins) parts.push(dc.wins)
    if (dc.friction) parts.push(dc.friction)
    if (dc.journal) parts.push(dc.journal)
    if (parts.length > 0) {
      stream.push({
        timestamp: dc.completed_at ?? `${dc.completion_date}T23:00:00Z`,
        type: 'reflection',
        text: parts.join(' · '),
        source_id: dc.id,
      })
    }
  }

  // Sort chronologically
  stream.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  return NextResponse.json(stream)
}

/** Convert a local date string (YYYY-MM-DD) at midnight in the given timezone to a UTC ISO string. */
function localMidnightToUTC(dateStr: string, tz: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = d.toLocaleString('en-US', { timeZone: tz })
  const utcMs = new Date(utcStr).getTime()
  const localMs = new Date(localStr).getTime()
  const offsetMs = localMs - utcMs
  const midnightUTC = new Date(dateStr + 'T00:00:00Z')
  return new Date(midnightUTC.getTime() - offsetMs).toISOString()
}
