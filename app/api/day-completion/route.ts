import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/day-completion?date=YYYY-MM-DD
// or GET /api/day-completion?unclosed=true (returns dates with committed action_items but no day_completion, last 14 days)
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

    // Get all dates that have committed action_items in the last 14 days (excluding today)
    const { data: commitDates } = await supabase
      .from('action_items')
      .select('committed_date')
      .eq('user_id', user.id)
      .not('committed_date', 'is', null)
      .not('status', 'in', '("rescheduled","dismissed","archived")')
      .gte('committed_date', fourteenDaysAgo)
      .lt('committed_date', today)

    if (!commitDates?.length) return NextResponse.json([])

    const uniqueDates = [...new Set(commitDates.map(s => s.committed_date))].sort()

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

  // Store heat snapshot for retrospective animation (fire-and-forget)
  try {
    const heatRes = await fetch(new URL('/api/map/heat', req.url), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    })
    const heatData = await heatRes.json()
    if (heatData?.heat?.length) {
      const snapshots = heatData.heat.map((h: { value_id: string; heat: number }) => ({
        user_id: user.id,
        value_id: h.value_id,
        heat: h.heat,
        score: Math.round(1 + h.heat * 9),
        snapshot_date: completion_date,
      }))
      await supabase.from('value_heat_snapshots').upsert(snapshots, {
        onConflict: 'user_id,value_id,snapshot_date',
      })
    }
  } catch {
    // Non-critical — don't fail day completion if snapshot fails
  }

  return NextResponse.json(data, { status: 201 })
}
