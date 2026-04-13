import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserToday } from '@/lib/timezone'

const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  seasonal: 90,
  annual: 365,
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const MAX_PER_DAY = 15
const MAX_PER_WEEK = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Support single day or week range
  let targetDates: string[]
  if (body.week_start_date) {
    const start = new Date(body.week_start_date)
    targetDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  } else {
    targetDates = [body.target_date ?? await getUserToday(supabase, user.id)]
  }

  const isWeek = targetDates.length > 1
  const weekStart = targetDates[0]
  const weekEnd = targetDates[targetDates.length - 1]

  const since = new Date(weekStart)
  since.setFullYear(since.getFullYear() - 1)
  const sinceStr = since.toISOString().split('T')[0]

  // --- Load task_suggestions (primary source) ---
  const { data: taskSuggestions, error: tsErr } = await supabase
    .from('task_suggestions')
    .select(`
      id, name, time_type, recurrence,
      preferred_days, preferred_time, flexibility, emotional_weight,
      duration_range_min, duration_range_max, context, sort_order,
      last_completed_at, last_proposed_at, consecutive_dismissals,
      activity_id, is_active, archived_at,
      value_links:task_suggestion_value_links(
        value_id,
        contribution_strength,
        value:user_values(score, sufficiency_mark, layer)
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('archived_at', null)
    .neq('recurrence', 'one_time')

  if (tsErr) return NextResponse.json({ error: tsErr.message }, { status: 500 })

  // --- Load Activities without child task_suggestions (fallback source) ---
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      id, name, frequency, time_type, flexibility, emotional_weight,
      preferred_days, context, sort_order,
      value_links:activity_value_links(
        value_id,
        contribution_strength,
        value:user_values(score, sufficiency_mark, layer)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('activity_type', 'recurring')
    .is('archived_at', null)

  // Find activity IDs that already have task_suggestions
  const activitiesWithSuggestions = new Set((taskSuggestions ?? []).map(ts => ts.activity_id).filter(Boolean))
  const standaloneActivities = (activities ?? []).filter(a => !activitiesWithSuggestions.has(a.id))

  // --- Load completion history ---
  const { data: completionLogs } = await supabase
    .from('action_log')
    .select('activity_id, task_suggestion_id, event_date')
    .eq('user_id', user.id)
    .eq('event_type', 'completed')
    .gte('event_date', sinceStr)

  // Build last-completion maps
  const lastCompletedByActivity: Record<string, Date> = {}
  const lastCompletedByTaskSuggestion: Record<string, Date> = {}
  for (const log of completionLogs ?? []) {
    if (log.activity_id) {
      const dt = new Date(log.event_date)
      if (!lastCompletedByActivity[log.activity_id] || dt > lastCompletedByActivity[log.activity_id]) {
        lastCompletedByActivity[log.activity_id] = dt
      }
    }
    if (log.task_suggestion_id) {
      const dt = new Date(log.event_date)
      if (!lastCompletedByTaskSuggestion[log.task_suggestion_id] || dt > lastCompletedByTaskSuggestion[log.task_suggestion_id]) {
        lastCompletedByTaskSuggestion[log.task_suggestion_id] = dt
      }
    }
  }

  // --- Load dismissed items ---
  const { data: dismissedItems } = await supabase
    .from('action_log')
    .select('task_suggestion_id, activity_id, event_date')
    .eq('user_id', user.id)
    .eq('event_type', 'dismissed')
    .gte('event_date', sinceStr)

  const lastDismissedByTS: Record<string, Date> = {}
  const lastDismissedByActivity: Record<string, Date> = {}
  for (const d of dismissedItems ?? []) {
    if (d.task_suggestion_id) {
      const dt = new Date(d.event_date)
      if (!lastDismissedByTS[d.task_suggestion_id] || dt > lastDismissedByTS[d.task_suggestion_id]) {
        lastDismissedByTS[d.task_suggestion_id] = dt
      }
    }
    if (d.activity_id && !d.task_suggestion_id) {
      const dt = new Date(d.event_date)
      if (!lastDismissedByActivity[d.activity_id] || dt > lastDismissedByActivity[d.activity_id]) {
        lastDismissedByActivity[d.activity_id] = dt
      }
    }
  }

  // --- Load existing candidate action_items (avoid duplicates) ---
  const { data: existingCandidates } = await supabase
    .from('action_items')
    .select('activity_id, task_suggestion_id, proposed_date')
    .eq('user_id', user.id)
    .eq('status', 'candidate')

  const candidateByKey = new Set(
    (existingCandidates ?? [])
      .filter(h => h.task_suggestion_id && h.proposed_date)
      .map(h => `${h.task_suggestion_id}:${h.proposed_date}`)
  )

  const candidateByActivityDate = new Set(
    (existingCandidates ?? [])
      .filter(h => h.activity_id && h.proposed_date)
      .map(h => `${h.activity_id}:${h.proposed_date}`)
  )

  // One item per activity across ALL candidate items (not just this week)
  // Prevents opening different weeks from creating duplicate entries
  const candidateActivityIds = new Set(
    (existingCandidates ?? [])
      .filter(h => h.activity_id)
      .map(h => h.activity_id as string)
  )
  // Also track within this run so the first day wins even before DB flush
  const proposedActivityIdsThisRun = new Set<string>()

  // --- Load committed/in_progress/completed action_items for coverage check ---
  const today = await getUserToday(supabase, user.id)
  const { data: coveredItems } = await supabase
    .from('action_items')
    .select('activity_id, committed_date')
    .eq('user_id', user.id)
    .in('status', ['committed', 'in_progress', 'completed'])
    .gte('committed_date', weekStart)
    .lte('committed_date', weekEnd)

  // Set of activity_ids already covered within the target week range
  const coveredActivityIds = new Set(
    (coveredItems ?? [])
      .filter(s => s.activity_id)
      .map(s => s.activity_id as string)
  )

  // --- Load block types for hint assignment ---
  const { data: blockTypes } = await supabase
    .from('block_types')
    .select('id, name, time_type')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const blockTypeByTimeType: Record<string, string> = {}
  for (const bt of blockTypes ?? []) {
    if (!blockTypeByTimeType[bt.time_type]) blockTypeByTimeType[bt.time_type] = bt.id
  }

  // --- Compute waterfall priority score for a set of value_links ---
  const LAYER_MULTIPLIER: Record<string, number> = { safety: 4, security: 3, freedom: 2, opportunity: 1 }
  function computeValueUrgency(valueLinks: Array<Record<string, unknown>>): number {
    if (!valueLinks?.length) return 0
    return valueLinks.reduce((acc, vl) => {
      // Supabase returns nested selects as arrays; handle both array and object
      const rawVal = vl.value
      const v = Array.isArray(rawVal) ? rawVal[0] : rawVal
      if (!v) return acc
      const gap = (v as { sufficiency_mark: number; score: number }).sufficiency_mark - (v as { score: number }).score
      if (gap <= 0) return acc
      const cs = vl.contribution_strength as string
      const strengthMult = cs === 'strong' ? 3 : cs === 'moderate' ? 2 : 1
      const layerMult = LAYER_MULTIPLIER[(v as { layer: string }).layer] ?? 1
      return acc + (gap * strengthMult * layerMult)
    }, 0)
  }

  // --- isDue check ---
  function isDue(cadenceDays: number, lastDone: Date | undefined, targetDay: Date, preferredDays: string[] | null): boolean {
    if (preferredDays?.length) {
      const targetDayName = DAY_NAMES[targetDay.getDay()]
      if (!preferredDays.map(d => d.toLowerCase()).includes(targetDayName)) return false
    }
    const daysSince = lastDone
      ? Math.floor((targetDay.getTime() - lastDone.getTime()) / (1000 * 60 * 60 * 24))
      : cadenceDays // never done = treat as due
    return daysSince >= cadenceDays
  }

  // --- Collect candidates for each target date ---
  const totalCreated: unknown[] = []
  let weekCreatedCount = 0

  for (const targetDate of targetDates) {
    if (isWeek && weekCreatedCount >= MAX_PER_WEEK) break

    const targetDay = new Date(targetDate)
    const candidates: Array<{
      urgency: number
      create: () => Promise<void>
    }> = []

    // --- Task suggestions ---
    for (const ts of taskSuggestions ?? []) {
      if (!ts.recurrence || !CADENCE_DAYS[ts.recurrence]) continue
      const cadence = CADENCE_DAYS[ts.recurrence]

      // Already covered this week (committed/in_progress/completed)
      if (ts.activity_id && coveredActivityIds.has(ts.activity_id)) continue

      // One item per activity per week
      if (isWeek && ts.activity_id && (candidateActivityIds.has(ts.activity_id) || proposedActivityIdsThisRun.has(ts.activity_id))) continue

      // Dismissed today
      const dismissed = lastDismissedByTS[ts.id]
      if (dismissed && dismissed.toISOString().split('T')[0] === targetDate) continue

      // Dismissed within cadence window
      if (dismissed) {
        const daysSinceDismissal = Math.floor((targetDay.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceDismissal < cadence) continue
      }

      // Already a candidate for this task_suggestion + date
      if (candidateByKey.has(`${ts.id}:${targetDate}`)) continue

      // Already a candidate for this activity + date
      if (ts.activity_id && candidateByActivityDate.has(`${ts.activity_id}:${targetDate}`)) continue

      const lastCompleted = lastCompletedByTaskSuggestion[ts.id] ?? (ts.activity_id ? lastCompletedByActivity[ts.activity_id] : undefined)
      const lastCompletedDate = lastCompleted ? new Date(lastCompleted) : undefined
      if (!isDue(cadence, lastCompletedDate, targetDay, ts.preferred_days)) continue

      const urgency = computeValueUrgency(ts.value_links ?? [])

      candidates.push({
        urgency,
        create: async () => {
          const { data: actionItem } = await supabase
            .from('action_items')
            .insert({
              user_id: user.id,
              name: ts.name,
              source: 'template_proposal',
              activity_id: ts.activity_id ?? null,
              task_suggestion_id: ts.id,
              status: 'candidate',
              proposed_date: targetDate,
              time_type: ts.time_type ?? 'B',
              bounding_type: 'action',
            })
            .select()
            .single()

          if (actionItem) {
            totalCreated.push(actionItem)
            if (ts.activity_id) {
              candidateByActivityDate.add(`${ts.activity_id}:${targetDate}`)
              candidateActivityIds.add(ts.activity_id)
              proposedActivityIdsThisRun.add(ts.activity_id)
            }
            candidateByKey.add(`${ts.id}:${targetDate}`)
            // Update last_proposed_at
            await supabase.from('task_suggestions')
              .update({ last_proposed_at: new Date().toISOString() })
              .eq('id', ts.id)
          }
        }
      })
    }

    // --- Standalone activities (no task_suggestions) ---
    for (const activity of standaloneActivities) {
      if (!activity.frequency || !CADENCE_DAYS[activity.frequency]) continue
      const cadence = CADENCE_DAYS[activity.frequency]

      if (coveredActivityIds.has(activity.id)) continue
      if (candidateByActivityDate.has(`${activity.id}:${targetDate}`)) continue

      // One item per activity per week
      if (isWeek && (candidateActivityIds.has(activity.id) || proposedActivityIdsThisRun.has(activity.id))) continue

      const dismissed = lastDismissedByActivity[activity.id]
      if (dismissed && dismissed.toISOString().split('T')[0] === targetDate) continue
      if (dismissed) {
        const daysSince = Math.floor((targetDay.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince < cadence) continue
      }

      const lastCompleted = lastCompletedByActivity[activity.id]
      const lastCompletedDate = lastCompleted ? new Date(lastCompleted) : undefined
      if (!isDue(cadence, lastCompletedDate, targetDay, activity.preferred_days)) continue

      const urgency = computeValueUrgency(activity.value_links ?? [])

      candidates.push({
        urgency,
        create: async () => {
          const { data: actionItem } = await supabase
            .from('action_items')
            .insert({
              user_id: user.id,
              name: activity.name,
              source: 'template_proposal',
              activity_id: activity.id,
              task_suggestion_id: null,
              status: 'candidate',
              proposed_date: targetDate,
              time_type: activity.time_type ?? 'B',
              bounding_type: 'action',
            })
            .select()
            .single()

          if (actionItem) {
            totalCreated.push(actionItem)
            candidateByActivityDate.add(`${activity.id}:${targetDate}`)
            candidateActivityIds.add(activity.id)
            proposedActivityIdsThisRun.add(activity.id)
          }
        }
      })
    }

    // Sort by urgency descending, apply per-day cap
    candidates.sort((a, b) => b.urgency - a.urgency)
    const daySlots = isWeek
      ? Math.min(MAX_PER_DAY, MAX_PER_WEEK - weekCreatedCount)
      : MAX_PER_DAY
    const dayBatch = candidates.slice(0, daySlots)

    for (const c of dayBatch) {
      await c.create()
      weekCreatedCount++
    }
  }

  return NextResponse.json({ created: totalCreated.length })
}
