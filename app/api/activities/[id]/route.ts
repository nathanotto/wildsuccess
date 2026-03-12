import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { value_links, ...fields } = body

  const { data, error } = await supabase
    .from('activities')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (value_links !== undefined) {
    await supabase.from('activity_value_links').delete().eq('activity_id', id)
    if (value_links.length) {
      await supabase.from('activity_value_links').insert(
        value_links.map((l: { value_id: string; contribution_strength: string }) => ({
          user_id: user.id, activity_id: id,
          value_id: l.value_id, contribution_strength: l.contribution_strength ?? 'moderate',
        }))
      )
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
