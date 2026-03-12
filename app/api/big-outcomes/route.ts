import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: outcomes, error } = await supabase
    .from('big_outcomes')
    .select('*, big_outcome_value_links(id, value_id, contribution_strength)')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: actCounts } = await supabase
    .from('activities')
    .select('big_outcome_id')
    .not('big_outcome_id', 'is', null)

  const countMap: Record<string, number> = {}
  actCounts?.forEach(a => {
    if (a.big_outcome_id) countMap[a.big_outcome_id] = (countMap[a.big_outcome_id] ?? 0) + 1
  })

  const result = outcomes?.map(o => ({
    ...o,
    value_links: o.big_outcome_value_links,
    activity_count: countMap[o.id] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, status, target_date, life_domain_id, value_links } = body

  const { data: outcome, error } = await supabase
    .from('big_outcomes')
    .insert({ user_id: user.id, name, description, status: status ?? 'aspirational', target_date, life_domain_id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (value_links?.length) {
    await supabase.from('big_outcome_value_links').insert(
      value_links.map((l: { value_id: string; contribution_strength: string }) => ({
        user_id: user.id, big_outcome_id: outcome.id,
        value_id: l.value_id, contribution_strength: l.contribution_strength ?? 'moderate',
      }))
    )
  }

  return NextResponse.json(outcome, { status: 201 })
}
