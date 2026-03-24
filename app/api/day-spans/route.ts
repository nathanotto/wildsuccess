import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/day-spans?week_start=YYYY-MM-DD&week_end=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = req.nextUrl.searchParams.get('week_start')
  const weekEnd = req.nextUrl.searchParams.get('week_end')

  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: 'week_start and week_end required' }, { status: 400 })
  }

  const { data: spans, error } = await supabase
    .from('day_spans')
    .select('*, day_span_value_links(id, user_id, day_span_id, value_id, contribution_strength, created_at)')
    .eq('user_id', user.id)
    .lte('start_date', weekEnd)
    .gte('end_date', weekStart)
    .order('start_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch person names for spans with person_id
  const personIds = [...new Set((spans ?? []).filter(s => s.person_id).map(s => s.person_id))]
  let personMap: Record<string, string> = {}
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from('known_people')
      .select('id, name')
      .in('id', personIds)
    if (people) {
      personMap = Object.fromEntries(people.map(p => [p.id, p.name]))
    }
  }

  const enriched = (spans ?? []).map(s => ({
    ...s,
    value_links: s.day_span_value_links ?? [],
    person: s.person_id ? { id: s.person_id, name: personMap[s.person_id] ?? '' } : null,
    day_span_value_links: undefined,
  }))

  return NextResponse.json(enriched)
}

// POST /api/day-spans
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, start_date, end_date, person_id, color, note, value_links } = body

  if (!name || !start_date || !end_date) {
    return NextResponse.json({ error: 'name, start_date, end_date required' }, { status: 400 })
  }

  const { data: span, error } = await supabase
    .from('day_spans')
    .insert({
      user_id: user.id,
      name,
      start_date,
      end_date,
      person_id: person_id || null,
      color: color || null,
      note: note || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert value links if provided
  if (Array.isArray(value_links) && value_links.length > 0) {
    const links = value_links.map((vl: { value_id: string; contribution_strength?: string }) => ({
      user_id: user.id,
      day_span_id: span.id,
      value_id: vl.value_id,
      contribution_strength: vl.contribution_strength || 'moderate',
    }))
    await supabase.from('day_span_value_links').insert(links)
  }

  // Re-fetch with value links
  const { data: full } = await supabase
    .from('day_spans')
    .select('*, day_span_value_links(id, user_id, day_span_id, value_id, contribution_strength, created_at)')
    .eq('id', span.id)
    .single()

  const result = full ? {
    ...full,
    value_links: full.day_span_value_links ?? [],
    day_span_value_links: undefined,
  } : span

  return NextResponse.json(result)
}
