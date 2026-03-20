import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Get current item
  const { data: current, error: fetchError } = await supabase
    .from('action_items')
    .select('name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oldName = current.name
  const newName = name.trim()

  if (oldName === newName) return NextResponse.json({ changed: false })

  // Update the action item name
  const { data: updated, error: updateError } = await supabase
    .from('action_items')
    .update({ name: newName })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Preserve old title as a completed step
  const { data: note } = await supabase
    .from('item_notes')
    .insert({
      user_id: user.id,
      action_item_id: id,
      note_type: 'step',
      content: oldName,
      is_completed: true,
      sort_order: 0,
    })
    .select()
    .single()

  return NextResponse.json({ item: updated, oldTitleNote: note, changed: true })
}
