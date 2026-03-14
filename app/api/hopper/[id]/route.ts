import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, proposed_date, metadata, activity_id, raw_input } = body

  const update: Record<string, unknown> = {}
  if (raw_input !== undefined) update.raw_input = raw_input
  if (status !== undefined) {
    update.status = status
    if (['activated', 'dismissed', 'archived'].includes(status)) {
      update.resolved_at = new Date().toISOString()
    }
  }
  if (proposed_date !== undefined) update.proposed_date = proposed_date
  if (metadata !== undefined) update.metadata = metadata
  if (activity_id !== undefined) update.activity_id = activity_id

  const { data, error } = await supabase
    .from('hopper_items')
    .update(update)
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
  const { error } = await supabase
    .from('hopper_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
