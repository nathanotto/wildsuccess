import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { value_links, ...fields } = body

  if (fields.status === 'achieved') fields.completed_at = new Date().toISOString()
  if (fields.status === 'abandoned' && !fields.abandonment_reason) {
    return NextResponse.json({ error: 'abandonment_reason required when status is abandoned' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('big_outcomes')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (value_links !== undefined) {
    await supabase.from('big_outcome_value_links').delete().eq('big_outcome_id', id)
    if (value_links.length) {
      await supabase.from('big_outcome_value_links').insert(
        value_links.map((l: { value_id: string; contribution_strength: string }) => ({
          user_id: user.id, big_outcome_id: id,
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
  const { error } = await supabase.from('big_outcomes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
