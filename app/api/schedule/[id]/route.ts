import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = { ...body }

  // When completing, set completed_at
  if (body.status === 'completed' && !body.completed_at) {
    update.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('schedule_items')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If completing or skipping, log to action_log
  if (body.status === 'completed' || body.status === 'skipped') {
    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: body.status === 'completed' ? 'completed' : 'skipped',
      schedule_item_id: id,
      activity_id: data.activity_id ?? null,
      hopper_item_id: data.hopper_item_id ?? null,
      event_date: (data.scheduled_date ?? new Date().toISOString().split('T')[0]),
      note: data.completion_note ?? null,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('schedule_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
