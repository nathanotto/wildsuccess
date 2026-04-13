import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserTimezone, localDateOffsetInTz } from '@/lib/timezone'

const LAYER_ORDER = ['safety', 'security', 'freedom', 'opportunity'] as const

// GET /api/values/waterfall — values grouped by layer with sufficiency ratios and effort indicators
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tz = await getUserTimezone(supabase, user.id)
  const threeWeeksAgo = localDateOffsetInTz(tz, -21)
  const twoWeeksAgo   = localDateOffsetInTz(tz, -14)
  const oneWeekAgo    = localDateOffsetInTz(tz, -7)

  const [valuesRes, activityLinksRes, taskLinksRes, completionsRes, spansRes, spanLinksRes] = await Promise.all([
    supabase.from('user_values').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('activity_value_links').select('value_id, contribution_strength, activity_id').eq('user_id', user.id),
    supabase.from('task_suggestion_value_links').select('value_id, contribution_strength, task_suggestion_id').eq('user_id', user.id),
    supabase.from('action_log')
      .select('activity_id, task_suggestion_id, event_date')
      .eq('user_id', user.id)
      .eq('event_type', 'completed')
      .gte('event_date', threeWeeksAgo),
    supabase.from('day_spans')
      .select('id, start_date, end_date')
      .eq('user_id', user.id)
      .gte('end_date', threeWeeksAgo),
    supabase.from('day_span_value_links')
      .select('day_span_id, value_id, contribution_strength')
      .eq('user_id', user.id),
  ])

  const values = valuesRes.data ?? []
  const activityLinks = activityLinksRes.data ?? []
  const taskLinks = taskLinksRes.data ?? []
  const completions = completionsRes.data ?? []
  const spans = spansRes.data ?? []
  const spanLinks = spanLinksRes.data ?? []

  const strengthWeight = (s: string) => s === 'strong' ? 1.0 : s === 'moderate' ? 0.6 : 0.3

  // Build activity_id → value contributions map
  const activityToValues: Record<string, { value_id: string; weight: number }[]> = {}
  for (const al of activityLinks) {
    if (!activityToValues[al.activity_id]) activityToValues[al.activity_id] = []
    activityToValues[al.activity_id].push({ value_id: al.value_id, weight: strengthWeight(al.contribution_strength) })
  }

  // Build task_suggestion_id → value contributions map
  const taskToValues: Record<string, { value_id: string; weight: number }[]> = {}
  for (const tl of taskLinks) {
    if (!taskToValues[tl.task_suggestion_id]) taskToValues[tl.task_suggestion_id] = []
    taskToValues[tl.task_suggestion_id].push({ value_id: tl.value_id, weight: strengthWeight(tl.contribution_strength) })
  }

  // Compute effort per value per time window
  const effortTotal: Record<string, number> = {}
  const effortRecent: Record<string, number> = {}  // last 7 days
  const effortMid: Record<string, number> = {}     // days 8-14

  for (const c of completions) {
    const links = [
      ...(c.activity_id ? (activityToValues[c.activity_id] ?? []) : []),
      ...(c.task_suggestion_id ? (taskToValues[c.task_suggestion_id] ?? []) : []),
    ]
    for (const { value_id, weight } of links) {
      effortTotal[value_id] = (effortTotal[value_id] ?? 0) + weight
      if (c.event_date >= oneWeekAgo) {
        effortRecent[value_id] = (effortRecent[value_id] ?? 0) + weight
      } else if (c.event_date >= twoWeeksAgo) {
        effortMid[value_id] = (effortMid[value_id] ?? 0) + weight
      }
    }
  }

  // Source 2: Day span coverage — each day under a span counts as one effort unit per linked value
  const spanToLinks: Record<string, { value_id: string; weight: number }[]> = {}
  for (const sl of spanLinks) {
    if (!spanToLinks[sl.day_span_id]) spanToLinks[sl.day_span_id] = []
    spanToLinks[sl.day_span_id].push({ value_id: sl.value_id, weight: strengthWeight(sl.contribution_strength) })
  }

  const today = localDateOffsetInTz(tz, 0)
  for (const span of spans) {
    const links = spanToLinks[span.id]
    if (!links || links.length === 0) continue
    // Count days within the 3-week window
    const windowStart = threeWeeksAgo
    const clampedStart = span.start_date > windowStart ? span.start_date : windowStart
    const clampedEnd = span.end_date < today ? span.end_date : today
    if (clampedStart > clampedEnd) continue
    const startMs = new Date(clampedStart).getTime()
    const endMs = new Date(clampedEnd).getTime()
    const dayCount = Math.floor((endMs - startMs) / 86400000) + 1
    for (const { value_id, weight } of links) {
      const contribution = dayCount * weight
      effortTotal[value_id] = (effortTotal[value_id] ?? 0) + contribution
      // Split into recent/mid windows for trend
      for (let i = 0; i < dayCount; i++) {
        const dayDate = new Date(startMs + i * 86400000).toISOString().split('T')[0]
        if (dayDate >= oneWeekAgo) {
          effortRecent[value_id] = (effortRecent[value_id] ?? 0) + weight
        } else if (dayDate >= twoWeeksAgo) {
          effortMid[value_id] = (effortMid[value_id] ?? 0) + weight
        }
      }
    }
  }

  // Enrich values and group by layer
  const enriched = values.map(v => {
    const ratio = v.sufficiency_mark > 0 ? v.score / v.sufficiency_mark : 1
    const recent = effortRecent[v.id] ?? 0
    const mid = effortMid[v.id] ?? 0
    const trend = recent - mid  // positive = improving, negative = declining
    return {
      ...v,
      sufficiency_ratio: Math.round(ratio * 100) / 100,
      effort_3w: Math.round((effortTotal[v.id] ?? 0) * 10) / 10,
      effort_trend: Math.round(trend * 10) / 10,
    }
  })

  const grouped: Record<string, typeof enriched> = {}
  for (const layer of LAYER_ORDER) {
    grouped[layer] = enriched.filter(v => v.layer === layer)
  }

  return NextResponse.json({ layers: grouped, order: LAYER_ORDER })
}
