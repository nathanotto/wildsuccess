import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annual: 365,
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const targetDate: string = body.target_date ?? new Date().toISOString().split('T')[0]
  const today = new Date(targetDate)
  const todayDayName = DAY_NAMES[today.getDay()]

  // Load all active recurring activities
  const { data: activities, error: aErr } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('activity_type', 'recurring')
    .is('archived_at', null)

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  if (!activities?.length) return NextResponse.json({ created: [] })

  // Fix 2: read completions from action_log (not schedule_items)
  const since = new Date(targetDate)
  since.setFullYear(since.getFullYear() - 1)

  const { data: completionLogs } = await supabase
    .from('action_log')
    .select('activity_id, event_date')
    .eq('user_id', user.id)
    .eq('event_type', 'completed')
    .not('activity_id', 'is', null)
    .gte('event_date', since.toISOString().split('T')[0])

  // Fix 3: load dismissed hopper items (within last year) to avoid re-proposing
  const { data: dismissedItems } = await supabase
    .from('hopper_items')
    .select('activity_id, resolved_at')
    .eq('user_id', user.id)
    .eq('status', 'dismissed')
    .not('activity_id', 'is', null)
    .gte('resolved_at', since.toISOString())

  // Build a map: activity_id -> most recent dismissal date
  const lastDismissed: Record<string, Date> = {}
  for (const d of dismissedItems ?? []) {
    if (!d.activity_id || !d.resolved_at) continue
    const dt = new Date(d.resolved_at)
    if (!lastDismissed[d.activity_id] || dt > lastDismissed[d.activity_id]) {
      lastDismissed[d.activity_id] = dt
    }
  }

  // Load existing pending hopper items (avoid duplicates)
  const { data: existingHopper } = await supabase
    .from('hopper_items')
    .select('activity_id, proposed_date')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const pendingSet = new Set(
    (existingHopper ?? [])
      .filter(h => h.activity_id)
      .map(h => h.activity_id as string)
  )

  // Build last-completion map: activity_id -> most recent completion date
  const lastCompleted: Record<string, Date> = {}
  for (const log of completionLogs ?? []) {
    if (!log.activity_id) continue
    const dt = new Date(log.event_date)
    if (!lastCompleted[log.activity_id] || dt > lastCompleted[log.activity_id]) {
      lastCompleted[log.activity_id] = dt
    }
  }

  const created: unknown[] = []

  for (const activity of activities) {
    if (!activity.frequency) continue
    const cadence = CADENCE_DAYS[activity.frequency]
    if (!cadence) continue

    // Already in hopper as pending — skip
    if (pendingSet.has(activity.id)) continue

    // Fix 4: preferred_days filter — if set, only propose on matching days
    if (Array.isArray(activity.preferred_days) && activity.preferred_days.length > 0) {
      const preferred = activity.preferred_days.map((d: string) => d.toLowerCase())
      if (!preferred.includes(todayDayName)) continue
    }

    // Is it due? Check last completion
    const lastDone = lastCompleted[activity.id]
    const daysSinceCompletion = lastDone
      ? Math.floor((today.getTime() - lastDone.getTime()) / (1000 * 60 * 60 * 24))
      : cadence // never done = treat as overdue

    if (daysSinceCompletion < cadence) continue

    // Fix 3: was it dismissed recently (within this cadence window)?
    const dismissed = lastDismissed[activity.id]
    if (dismissed) {
      const daysSinceDismissal = Math.floor((today.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24))
      // If dismissed more recently than the last completion, skip for this cadence window
      if (daysSinceDismissal < cadence) continue
    }

    const { data: hopperItem, error: hErr } = await supabase
      .from('hopper_items')
      .insert({
        user_id: user.id,
        raw_input: activity.name,
        source: 'template_proposal',
        activity_id: activity.id,
        status: 'pending',
        proposed_date: targetDate,
      })
      .select()
      .single()

    if (!hErr && hopperItem) {
      created.push(hopperItem)
      pendingSet.add(activity.id)
    }
  }

  return NextResponse.json({ created })
}
