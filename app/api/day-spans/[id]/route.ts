import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/day-spans/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { value_links, ...spanFields } = body

  // Update span fields
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['name', 'start_date', 'end_date', 'person_id', 'color', 'note']) {
    if (key in spanFields) updateData[key] = spanFields[key] || null
  }
  // name should not be nulled
  if ('name' in spanFields && spanFields.name) updateData.name = spanFields.name

  const { error } = await supabase
    .from('day_spans')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace value links if provided
  if (Array.isArray(value_links)) {
    await supabase.from('day_span_value_links').delete().eq('day_span_id', id).eq('user_id', user.id)
    if (value_links.length > 0) {
      const links = value_links.map((vl: { value_id: string; contribution_strength?: string }) => ({
        user_id: user.id,
        day_span_id: id,
        value_id: vl.value_id,
        contribution_strength: vl.contribution_strength || 'moderate',
      }))
      await supabase.from('day_span_value_links').insert(links)
    }
  }

  // Re-fetch with value links
  const { data: full } = await supabase
    .from('day_spans')
    .select('*, day_span_value_links(id, user_id, day_span_id, value_id, contribution_strength, created_at)')
    .eq('id', id)
    .single()

  const result = full ? {
    ...full,
    value_links: full.day_span_value_links ?? [],
    day_span_value_links: undefined,
  } : { id }

  return NextResponse.json(result)
}

// DELETE /api/day-spans/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('day_spans')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
