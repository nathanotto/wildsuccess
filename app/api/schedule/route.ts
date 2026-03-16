import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date')
  const rangeStart = sp.get('range_start')
  const rangeEnd = sp.get('range_end')

  let query = supabase
    .from('schedule_items')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date')
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  if (date) {
    query = query.eq('scheduled_date', date)
  } else if (rangeStart && rangeEnd) {
    query = query.gte('scheduled_date', rangeStart).lte('scheduled_date', rangeEnd)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    activity_id, hopper_item_id, task_suggestion_id, name, description,
    scheduled_date, scheduled_time, scheduled_end_time,
    flexibility = 'anytime_today', context = [], time_type = 'B',
    emotional_weight = 'normal', bounding_type = 'action',
  } = body

  if (!name || !scheduled_date) {
    return NextResponse.json({ error: 'name and scheduled_date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('schedule_items')
    .insert({
      user_id: user.id,
      activity_id: activity_id ?? null,
      hopper_item_id: hopper_item_id ?? null,
      task_suggestion_id: task_suggestion_id ?? null,
      name,
      description: description ?? null,
      scheduled_date,
      scheduled_time: scheduled_time ?? null,
      scheduled_end_time: scheduled_end_time ?? null,
      flexibility,
      context,
      time_type,
      emotional_weight,
      bounding_type,
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If created from hopper, update hopper status to activated
  if (hopper_item_id) {
    await supabase
      .from('hopper_items')
      .update({ status: 'activated', resolved_at: new Date().toISOString() })
      .eq('id', hopper_item_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json(data, { status: 201 })
}
