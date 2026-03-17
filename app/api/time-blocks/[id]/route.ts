import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('time_blocks')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Before deleting, restore any linked hopper items to pending
  // (Postgres ON DELETE SET NULL would otherwise orphan schedule items invisibly)
  const { data: schedItems } = await supabase
    .from('schedule_items')
    .select('id, hopper_item_id')
    .eq('time_block_id', id)
    .eq('user_id', user.id)

  const hopperIds = [...new Set((schedItems ?? []).map(s => s.hopper_item_id).filter(Boolean))]
  if (hopperIds.length > 0) {
    await supabase
      .from('hopper_items')
      .update({ status: 'pending', resolved_at: null })
      .in('id', hopperIds)
      .eq('user_id', user.id)
  }

  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
