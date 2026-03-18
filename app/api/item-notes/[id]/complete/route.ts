import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: note, error: fetchError } = await supabase
    .from('item_notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('item_notes')
    .update({ is_completed: true })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log the step completion
  await supabase.from('action_log').insert({
    user_id: user.id,
    event_type: 'completed',
    schedule_item_id: note.schedule_item_id,
    event_date: new Date().toISOString().split('T')[0],
    metadata: { step_note_id: id, step_content: note.content },
  })

  return NextResponse.json(data)
}
