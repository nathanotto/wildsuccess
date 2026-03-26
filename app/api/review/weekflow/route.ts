import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = req.nextUrl.searchParams.get('week_start')
  if (!weekStart) return NextResponse.json({ error: 'week_start required' }, { status: 400 })

  const startDate = new Date(weekStart + 'T12:00:00')
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const weekEnd = fmtDate(endDate)

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Build the 7 date strings
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    dates.push(fmtDate(d))
  }

  const [itemsRes, loggedRes, reflectionsRes, spansRes] = await Promise.all([
    supabase
      .from('action_items')
      .select('id, name, status, scheduled_time, completed_at, committed_date, created_at, time_type')
      .eq('user_id', user.id)
      .gte('committed_date', weekStart)
      .lte('committed_date', weekEnd),
    supabase
      .from('action_log')
      .select('id, note, event_date, created_at')
      .eq('user_id', user.id)
      .eq('event_type', 'logged')
      .gte('event_date', weekStart)
      .lte('event_date', weekEnd),
    supabase
      .from('day_reflection')
      .select('reflection_date, mood_energy, wins, friction, journal_note')
      .eq('user_id', user.id)
      .gte('reflection_date', weekStart)
      .lte('reflection_date', weekEnd),
    supabase
      .from('day_spans')
      .select('id, name, start_date, end_date, color, person_id')
      .eq('user_id', user.id)
      .lte('start_date', weekEnd)
      .gte('end_date', weekStart),
  ])

  const items = itemsRes.data ?? []
  const logged = loggedRes.data ?? []
  const reflections = reflectionsRes.data ?? []
  const spans = spansRes.data ?? []

  // Fetch person names for spans
  const personIds = [...new Set(spans.filter(s => s.person_id).map(s => s.person_id!))]
  let personMap: Record<string, string> = {}
  if (personIds.length > 0) {
    const { data: people } = await supabase.from('known_people').select('id, name').in('id', personIds)
    if (people) personMap = Object.fromEntries(people.map(p => [p.id, p.name]))
  }

  const enrichedSpans = spans.map(s => ({
    ...s,
    person_name: s.person_id ? (personMap[s.person_id] ?? null) : null,
  }))

  // Build per-day data
  const days = dates.map(date => {
    const ref = reflections.find(r => r.reflection_date === date)
    const dayItems = items.filter(i => i.committed_date === date)
    const dayLogged = logged.filter(l => l.event_date === date)

    // Merge into stream
    type StreamEntry = { time: string; type: 'action_item'; name: string; status: string; time_type: string }
      | { time: string; type: 'logged'; text: string }

    const stream: StreamEntry[] = []

    for (const item of dayItems) {
      let time: string
      if (item.status === 'completed' && item.completed_at) {
        time = extractTime(item.completed_at)
      } else if (item.scheduled_time) {
        time = item.scheduled_time.slice(0, 5)
      } else {
        time = extractTime(item.created_at)
      }
      stream.push({ time, type: 'action_item', name: item.name, status: item.status, time_type: item.time_type ?? 'B' })
    }

    for (const log of dayLogged) {
      const time = extractTime(log.created_at)
      stream.push({ time, type: 'logged', text: log.note ?? '' })
    }

    stream.sort((a, b) => a.time.localeCompare(b.time))

    const d = new Date(date + 'T12:00:00')

    return {
      date,
      day_of_week: DAY_NAMES[d.getDay()],
      reflection: ref ? {
        wins: ref.wins ?? null,
        friction: ref.friction ?? null,
        journal_note: ref.journal_note ?? null,
        mood_energy: ref.mood_energy ?? null,
      } : null,
      stream,
    }
  })

  return NextResponse.json({ week_start: weekStart, spans: enrichedSpans, days })
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extractTime(iso: string): string {
  // Handle ISO datetime or just time
  if (!iso) return '00:00'
  const match = iso.match(/T(\d{2}):(\d{2})/)
  if (match) return `${match[1]}:${match[2]}`
  return '00:00'
}
