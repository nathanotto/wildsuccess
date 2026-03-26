import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .order('start_time')

  if (start) query = query.gte('start_time', start)
  if (end) query = query.lte('start_time', end)

  const { data: events, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join classifications
  const { data: classifications } = await supabase
    .from('calendar_event_classifications')
    .select('*')
    .eq('user_id', user.id)

  const classMap = new Map((classifications ?? []).map(c => [c.match_key, c]))

  // Load existing action_items for the date range so we can suppress calendar events
  // that already have a matching action_item (same name, same time slot)
  let existingItems: { name: string; scheduled_time: string | null; committed_date: string | null }[] = []
  if (start && end) {
    const startDate = start.split('T')[0]
    const endDate = end.split('T')[0]
    const { data: items } = await supabase
      .from('action_items')
      .select('name, scheduled_time, committed_date')
      .eq('user_id', user.id)
      .gte('committed_date', startDate)
      .lte('committed_date', endDate)
      .not('status', 'in', '("rescheduled","dismissed","archived")')
    existingItems = items ?? []
  }

  // Build a set of "date|time|name" keys for fast lookup
  const existingKeys = new Set(
    existingItems
      .filter(i => i.scheduled_time && i.committed_date)
      .map(i => `${i.committed_date}|${(i.scheduled_time ?? '').slice(0, 5)}|${i.name.trim().toLowerCase()}`)
  )

  const enriched: Record<string, unknown>[] = []
  for (const ev of (events ?? [])) {
    const cls = classMap.get(ev.external_series_id ?? '') ?? classMap.get(ev.external_event_id) ?? null

    // Hidden = user explicitly dismissed. Always suppress, no conditions.
    if (cls?.classification === 'hidden') continue

    // Confirmed = user turned it into a schedule_item. Suppress unless the event
    // changed in Google (different title/time), in which case reappear as provisional.
    if (cls?.classification === 'fixed_commitment') {
      if (!cls.suppressed_fingerprint) continue  // series: always suppress
      const fp = `${ev.title}|${ev.start_time}|${ev.end_time}`
      if (fp === cls.suppressed_fingerprint) continue  // unchanged: suppress
      enriched.push({ ...ev, classification: null })  // changed: reappear as provisional
      continue
    }

    // Suppress if an action_item with the same name and time already exists
    if (!ev.is_all_day && ev.start_time) {
      const evStart = new Date(ev.start_time)
      const evDate = `${evStart.getFullYear()}-${String(evStart.getMonth() + 1).padStart(2, '0')}-${String(evStart.getDate()).padStart(2, '0')}`
      const evTime = `${String(evStart.getHours()).padStart(2, '0')}:${String(evStart.getMinutes()).padStart(2, '0')}`
      const evTitle = (ev.title ?? '').trim().toLowerCase()
      if (existingKeys.has(`${evDate}|${evTime}|${evTitle}`)) continue
    }

    enriched.push({ ...ev, classification: cls })
  }

  return NextResponse.json(enriched)
}
