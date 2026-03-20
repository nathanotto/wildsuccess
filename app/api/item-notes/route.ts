import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actionItemId = req.nextUrl.searchParams.get('action_item_id')
  if (!actionItemId) return NextResponse.json({ error: 'action_item_id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('item_notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('action_item_id', actionItemId)
    .order('note_type', { ascending: true }) // notes grouped, steps by sort_order
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action_item_id, note_type, content, sort_order = 0 } = await req.json()
  if (!action_item_id || !note_type || !content?.trim()) {
    return NextResponse.json({ error: 'action_item_id, note_type, and content are required' }, { status: 400 })
  }
  if (!['note', 'step'].includes(note_type)) {
    return NextResponse.json({ error: 'note_type must be note or step' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('item_notes')
    .insert({
      user_id: user.id,
      action_item_id,
      note_type,
      content: content.trim(),
      is_completed: false,
      sort_order,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
