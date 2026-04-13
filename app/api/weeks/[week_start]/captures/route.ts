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

  // Compute week range in the user's timezone: Monday 00:00 local through next Monday 00:00 local
  // Use IANA timezone to get correct UTC offset for the boundaries
  const startLocal = new Date(`${week_start}T00:00:00`)
  const endDate = new Date(startLocal)
  endDate.setDate(endDate.getDate() + 7)
  const weekEndStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  // For timestamptz queries, we need the UTC equivalent of local midnight boundaries
  // Use Intl to find the UTC offset, then shift accordingly
  const startISO = localMidnightToUTC(week_start, tz)
  const endISO = localMidnightToUTC(weekEndStr, tz)

  // Fetch all capture-like content in parallel
  const [actionItemsRes, notesRes, logsRes, completionsRes] = await Promise.all([
    // Action items created during the week
    supabase
      .from('action_items')
      .select('id, name, created_at')
      .eq('user_id', user.id)
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
    // Day log entries during the week
    supabase
      .from('action_log')
      .select('id, note, metadata, created_at')
      .eq('user_id', user.id)
      .in('event_type', ['logged'])
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true }),
    // Day completion reflections during the week
    supabase
      .from('day_completions')
      .select('id, completion_date, wins, friction, journal, completed_at')
      .eq('user_id', user.id)
      .gte('completion_date', week_start)
      .lt('completion_date', weekEndStr)
      .order('completion_date', { ascending: true }),
  ])

  const stream: Array<{
    timestamp: string
    type: 'action_item' | 'note' | 'day_log' | 'reflection' | 'capture'
    text: string
    source_id: string
  }> = []

  // Action items
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

  // Day logs
  for (const log of logsRes.data ?? []) {
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
  // Create a date and use Intl to find the UTC offset at that date in that timezone
  const d = new Date(dateStr + 'T12:00:00Z') // noon UTC as reference
  const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = d.toLocaleString('en-US', { timeZone: tz })
  const utcMs = new Date(utcStr).getTime()
  const localMs = new Date(localStr).getTime()
  const offsetMs = localMs - utcMs // positive = east of UTC
  // Local midnight = UTC midnight - offset
  const midnightUTC = new Date(dateStr + 'T00:00:00Z')
  return new Date(midnightUTC.getTime() - offsetMs).toISOString()
}
