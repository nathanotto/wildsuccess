import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ week_start: string }> }

const CADENCE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, annual: 365,
}

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { week_start } = await params
  const weekEnd = addDays(week_start, 6)

  const [committedRes, parkedRes, carriedRes, activitiesRes, coverageRes] = await Promise.all([
    // 1. Committed items for this week
    supabase
      .from('action_items')
      .select('id, name, committed_date, scheduled_time, status, time_type, activity_id')
      .eq('user_id', user.id)
      .gte('committed_date', week_start)
      .lte('committed_date', weekEnd)
      .not('status', 'in', '("rescheduled","dismissed","archived")')
      .order('committed_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false }),

    // 2. Parked items coming due this week
    supabase
      .from('action_items')
      .select('id, name, parked_until, status, time_type')
      .eq('user_id', user.id)
      .eq('status', 'parked')
      .gte('parked_until', week_start)
      .lte('parked_until', weekEnd)
      .order('parked_until', { ascending: true }),

    // 3. Carried-forward items (committed/in_progress from before this week, unscheduled)
    supabase
      .from('action_items')
      .select('id, name, committed_date, status, time_type')
      .eq('user_id', user.id)
      .lt('committed_date', week_start)
      .is('scheduled_time', null)
      .in('status', ['committed', 'in_progress'])
      .order('committed_date', { ascending: true }),

    // 4. Active recurring activities (for "routine" suggestions)
    supabase
      .from('activities')
      .select('id, name, frequency, time_type, preferred_time, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('frequency', 'is', null),

    // Coverage: recent completions per activity (for cadence check)
    supabase
      .from('action_items')
      .select('activity_id, committed_date')
      .eq('user_id', user.id)
      .in('status', ['committed', 'in_progress', 'completed'])
      .not('activity_id', 'is', null)
      .not('committed_date', 'is', null),
  ])

  // Build committed items
  const committed = (committedRes.data ?? []).map(i => ({
    id: i.id, name: i.name, category: 'committed' as const,
    date: i.committed_date, time: i.scheduled_time,
    status: i.status, time_type: i.time_type,
  }))

  // Build parked items
  const parked = (parkedRes.data ?? []).map(i => ({
    id: i.id, name: i.name, category: 'returning' as const,
    date: i.parked_until, time: null,
    status: i.status, time_type: i.time_type,
  }))

  // Build carried-forward items
  const carried = (carriedRes.data ?? []).map(i => ({
    id: i.id, name: i.name, category: 'carried' as const,
    date: i.committed_date, time: null,
    status: i.status, time_type: i.time_type,
  }))

  // Build routine activities due this week (not already scheduled)
  const weekStartDate = new Date(week_start + 'T00:00:00')
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 7)

  // Set of activity_ids already scheduled this week
  const scheduledActivityIds = new Set(
    (committedRes.data ?? [])
      .filter(i => i.activity_id)
      .map(i => i.activity_id)
  )

  // Build coverage map for cadence window check
  const coverageMap: Record<string, Date[]> = {}
  for (const { activity_id, committed_date } of coverageRes.data ?? []) {
    if (!coverageMap[activity_id]) coverageMap[activity_id] = []
    coverageMap[activity_id].push(new Date(committed_date + 'T00:00:00'))
  }

  const now = new Date()
  const routines: Array<{ id: string; name: string; category: 'routine'; frequency: string; time_type: string }> = []

  for (const activity of activitiesRes.data ?? []) {
    if (!activity.frequency || !CADENCE_DAYS[activity.frequency]) continue
    if (scheduledActivityIds.has(activity.id)) continue

    // Check cadence — is this activity due within the week?
    const cadenceDays = CADENCE_DAYS[activity.frequency]
    const dates = coverageMap[activity.id] ?? []
    const lastDate = dates.length > 0 ? dates.sort((a, b) => b.getTime() - a.getTime())[0] : null
    const daysSinceLast = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : cadenceDays + 1

    if (daysSinceLast >= cadenceDays * 0.7) {
      routines.push({
        id: activity.id, name: activity.name, category: 'routine',
        frequency: activity.frequency, time_type: activity.time_type,
      })
    }
  }

  return NextResponse.json({ committed, parked, carried, routines })
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
