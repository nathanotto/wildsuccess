import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: activities, error } = await supabase
    .from('activities')
    .select(`
      *,
      activity_value_links(id, value_id, contribution_strength),
      life_domains(name),
      big_outcomes(name)
    `)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = activities?.map(a => ({
    ...a,
    value_links: a.activity_value_links,
    life_domain_name: (a.life_domains as { name: string } | null)?.name ?? null,
    big_outcome_name: (a.big_outcomes as { name: string } | null)?.name ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { value_links, ...fields } = body

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({ ...fields, user_id: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (value_links?.length) {
    await supabase.from('activity_value_links').insert(
      value_links.map((l: { value_id: string; contribution_strength: string }) => ({
        user_id: user.id, activity_id: activity.id,
        value_id: l.value_id, contribution_strength: l.contribution_strength ?? 'moderate',
      }))
    )
  }

  return NextResponse.json(activity, { status: 201 })
}
