import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { date } = await req.json()
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  // Moving to a different day: clear time fields since the new day's schedule is separate
  const { data, error } = await supabase
    .from('schedule_items')
    .update({
      scheduled_date: date,
      scheduled_time: null,
      scheduled_end_time: null,
      time_block_id: null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('action_log').insert({
    user_id: user.id,
    event_type: 'rescheduled',
    schedule_item_id: id,
    activity_id: data.activity_id ?? null,
    event_date: new Date().toISOString().split('T')[0],
    note: `moved to ${date}`,
  })

  return NextResponse.json({ item: data })
}
