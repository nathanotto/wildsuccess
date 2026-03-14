import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date')
  const event_type = sp.get('event_type')
  const rangeStart = sp.get('range_start')
  const rangeEnd = sp.get('range_end')

  let query = supabase
    .from('action_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (date) query = query.eq('event_date', date)
  else if (rangeStart && rangeEnd) query = query.gte('event_date', rangeStart).lte('event_date', rangeEnd)
  if (event_type) query = query.eq('event_type', event_type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { event_type, schedule_item_id, hopper_item_id, activity_id, task_suggestion_id, event_date, note, metadata } = body

  if (!event_type || !event_date) {
    return NextResponse.json({ error: 'event_type and event_date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('action_log')
    .insert({
      user_id: user.id,
      event_type,
      schedule_item_id: schedule_item_id ?? null,
      hopper_item_id: hopper_item_id ?? null,
      activity_id: activity_id ?? null,
      task_suggestion_id: task_suggestion_id ?? null,
      event_date,
      note: note ?? null,
      metadata: metadata ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
