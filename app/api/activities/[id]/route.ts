import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      activity_value_links(id, value_id, contribution_strength),
      activity_domain_links(id, domain_id, life_domains(name)),
      big_outcomes(name)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    value_links: data.activity_value_links,
    domain_links: (data.activity_domain_links as Array<{ id: string; domain_id: string; life_domains: { name: string } | null }>)?.map(dl => ({
      id: dl.id,
      domain_id: dl.domain_id,
      domain_name: dl.life_domains?.name ?? null,
    })) ?? [],
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { value_links, domain_links, ...fields } = body

  if (domain_links !== undefined && domain_links.length === 0) {
    return NextResponse.json({ error: 'At least one Life Domain is required' }, { status: 400 })
  }

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

  if (domain_links !== undefined) {
    await supabase.from('activity_domain_links').delete().eq('activity_id', id)
    await supabase.from('activity_domain_links').insert(
      domain_links.map((dl: { domain_id: string }) => ({
        user_id: user.id, activity_id: id, domain_id: dl.domain_id,
      }))
    )
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
