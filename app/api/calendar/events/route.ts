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

    enriched.push({ ...ev, classification: cls })
  }

  return NextResponse.json(enriched)
}
