import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  // Snapshot query: items that were "alive" on this date
  // - committed on or before this date
  // - not yet resolved by this date (completed_date null or >= date)
  // - scheduled items only from exact date; unscheduled roll from earlier dates
  // - parked items only if parked_until <= date
  const [itemsRes, loggedRes, reflectionRes, completionRes] = await Promise.all([
    supabase
      .from('action_items')
      .select('id, name, status, scheduled_time, completed_at, completed_date, committed_date, parked_until, sort_order')
      .eq('user_id', user.id)
      .lte('committed_date', date)
      .not('status', 'in', '("rescheduled","dismissed","archived")')
      .or(`completed_date.is.null,completed_date.gte.${date}`)
      .or(`committed_date.eq.${date},scheduled_time.is.null`)
      .or(`status.neq.parked,parked_until.lte.${date}`)
      .order('sort_order', { ascending: true }),
    supabase
      .from('action_log')
      .select('id, note, metadata, created_at')
      .eq('user_id', user.id)
      .eq('event_date', date)
      .eq('event_type', 'logged')
      .order('created_at', { ascending: true }),
    supabase
      .from('day_reflection')
      .select('mood_energy, journal_note, wins, friction, plan_status, closed_at')
      .eq('user_id', user.id)
      .eq('reflection_date', date)
      .maybeSingle(),
    supabase
      .from('day_completions')
      .select('mood, wins, friction, journal, completed_at')
      .eq('user_id', user.id)
      .eq('completion_date', date)
      .maybeSingle(),
  ])

  const allItems = (itemsRes.data ?? []).map(i => {
    // Compute snapshot display status for this date
    let displayStatus = i.status
    if (i.completed_date && i.completed_date <= date) displayStatus = 'completed'
    else if (i.completed_date && i.completed_date > date) displayStatus = 'committed'
    else if (i.status === 'parked' && i.parked_until && i.parked_until <= date) displayStatus = 'committed'
    return { ...i, displayStatus }
  })
  const completed = allItems
    .filter(i => i.displayStatus === 'completed')
    .sort((a, b) => {
      if (a.completed_at && b.completed_at) return a.completed_at.localeCompare(b.completed_at)
      return 0
    })
  const incomplete = allItems.filter(i => i.displayStatus !== 'completed' && i.displayStatus !== 'skipped')

  const reflection = reflectionRes.data
  const completion = completionRes.data

  // Merge reflection data: prefer day_reflection fields, fall back to day_completions
  const mood_energy = reflection?.mood_energy ?? completion?.mood ?? null
  const journal_note = reflection?.journal_note ?? completion?.journal ?? null
  const wins = reflection?.wins ?? completion?.wins ?? null
  const friction = reflection?.friction ?? completion?.friction ?? null

  // A day is "closed" if either day_reflection says so OR a day_completions row exists
  const isClosed = reflection?.plan_status === 'closed' || !!completion
  const plan_status = isClosed ? 'closed' : (reflection?.plan_status ?? 'open')

  // Compute metadata
  const d = new Date(date + 'T12:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })

  let daysAgoLabel = ''
  if (diffDays === 0) daysAgoLabel = 'Today'
  else if (diffDays === 1) daysAgoLabel = 'Yesterday'
  else if (diffDays < 14) daysAgoLabel = `${diffDays} days ago`
  else {
    const weeks = Math.floor(diffDays / 7)
    daysAgoLabel = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }

  return NextResponse.json({
    completed,
    incomplete,
    logged: loggedRes.data ?? [],
    reflection: { mood_energy, journal_note, wins, friction, plan_status },
    metadata: { date, dayOfWeek, daysAgo: diffDays, daysAgoLabel },
  })
}
