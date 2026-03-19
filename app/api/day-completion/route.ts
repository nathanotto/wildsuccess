import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/day-completion?date=YYYY-MM-DD
// or GET /api/day-completion?unclosed=true (returns dates with schedule_items but no day_completion, last 14 days)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date')
  const unclosed = sp.get('unclosed')

  if (date) {
    const { data, error } = await supabase
      .from('day_completions')
      .select('*')
      .eq('user_id', user.id)
      .eq('completion_date', date)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (unclosed === 'true') {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // Get all dates that have schedule_items in the last 14 days (excluding today)
    const { data: scheduleDates } = await supabase
      .from('schedule_items')
      .select('scheduled_date')
      .eq('user_id', user.id)
      .gte('scheduled_date', fourteenDaysAgo)
      .lt('scheduled_date', today)

    if (!scheduleDates?.length) return NextResponse.json([])

    const uniqueDates = [...new Set(scheduleDates.map(s => s.scheduled_date))].sort()

    // Get all day_completions in that range
    const { data: completions } = await supabase
      .from('day_completions')
      .select('completion_date')
      .eq('user_id', user.id)
      .gte('completion_date', fourteenDaysAgo)

    const completedDates = new Set((completions ?? []).map(c => c.completion_date))
    const unclosedDates = uniqueDates.filter(d => !completedDates.has(d))

    return NextResponse.json(unclosedDates)
  }

  return NextResponse.json({ error: 'Provide date or unclosed=true' }, { status: 400 })
}

// POST /api/day-completion
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { completion_date, mood, wins, friction, journal } = body

  if (!completion_date) {
    return NextResponse.json({ error: 'completion_date is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('day_completions')
    .upsert({
      user_id: user.id,
      completion_date,
      mood: mood ?? null,
      wins: wins ?? null,
      friction: friction ?? null,
      journal: journal ?? null,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,completion_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
