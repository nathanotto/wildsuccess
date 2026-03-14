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

  const enriched = (events ?? []).map(ev => ({
    ...ev,
    classification: classMap.get(ev.external_series_id ?? '') ?? classMap.get(ev.external_event_id) ?? null,
  }))

  return NextResponse.json(enriched)
}
