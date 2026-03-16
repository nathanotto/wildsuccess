import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const LAYER_ORDER = ['safety', 'security', 'freedom', 'opportunity'] as const

// GET /api/values/waterfall — values grouped by layer with sufficiency ratios and effort indicators
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const threeWeeksAgo = new Date(Date.now() - 21 * 86400000).toISOString().split('T')[0]
  const twoWeeksAgo   = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  const oneWeekAgo    = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0]

  const [valuesRes, activityLinksRes, taskLinksRes, completionsRes] = await Promise.all([
    supabase.from('user_values').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('activity_value_links').select('value_id, contribution_strength, activity_id').eq('user_id', user.id),
    supabase.from('task_suggestion_value_links').select('value_id, contribution_strength, task_suggestion_id').eq('user_id', user.id),
    supabase.from('action_log')
      .select('activity_id, task_suggestion_id, event_date')
      .eq('user_id', user.id)
      .eq('event_type', 'completed')
      .gte('event_date', threeWeeksAgo),
  ])

  const values = valuesRes.data ?? []
  const activityLinks = activityLinksRes.data ?? []
  const taskLinks = taskLinksRes.data ?? []
  const completions = completionsRes.data ?? []

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
