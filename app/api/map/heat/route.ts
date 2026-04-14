import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserTimezone, localDateInTz, localDateOffsetInTz } from '@/lib/timezone'

const ROLLING_WINDOW_DAYS = 30
const BIG_OUTCOME_DECAY_DAYS = 90
const BIG_OUTCOME_BASE_WEIGHT = 4.0 // ~4x a single strong daily completion

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tz = await getUserTimezone(supabase, user.id)
  const now = new Date()
  const todayStr = localDateInTz(tz)
  const cutoffStr = localDateOffsetInTz(tz, -ROLLING_WINDOW_DAYS)

  const boCutoffStr = localDateOffsetInTz(tz, -BIG_OUTCOME_DECAY_DAYS)

  const [{ data: values }, { data: links }, { data: logs }, { data: activities }, { data: scheduledItems }, { data: domainLinks }, { data: bigOutcomes }, { data: boValueLinks }] = await Promise.all([
    supabase.from('user_values').select('id'),
    supabase.from('activity_value_links').select('id, value_id, activity_id, contribution_strength'),
    // Fetch all logs in the rolling window + metadata for duration weighting
    supabase.from('action_log').select('activity_id, event_date, value_ids, metadata')
      .in('event_type', ['completed', 'logged'])
      .gte('event_date', cutoffStr)
      .order('event_date', { ascending: false }),
    supabase.from('activities').select('id, activity_type, frequency, status, is_preventive, alarm_threshold_days'),
    // Activities with a committed/in-progress action_item today or later — these are "addressed"
    supabase.from('action_items').select('activity_id').eq('user_id', user.id).not('activity_id', 'is', null).in('status', ['committed', 'in_progress']).gte('committed_date', todayStr),
    // Activity-domain links for domain heat aggregation
    supabase.from('activity_domain_links').select('activity_id, domain_id'),
    // Accomplished Big Outcomes within the longer decay window
    supabase.from('big_outcomes').select('id, closed_on')
      .eq('user_id', user.id)
      .in('closure_type', ['accomplished', 'declared_complete'])
      .not('closed_on', 'is', null)
      .gte('closed_on', boCutoffStr),
    // Big Outcome → value links
    supabase.from('big_outcome_value_links').select('big_outcome_id, value_id, contribution_strength')
      .eq('user_id', user.id),
  ])

  const scheduledActivityIds = new Set((scheduledItems ?? []).map(i => i.activity_id))

  const activityMap: Record<string, { activity_type: string; frequency: string | null; status: string; is_preventive: boolean; alarm_threshold_days: number }> = {}
  activities?.forEach(a => { activityMap[a.id] = a })

  // Group all logs by activity_id for cumulative counting
  const logsByActivity: Record<string, Array<{ event_date: string; metadata?: Record<string, unknown> | null }>> = {}
  const directValueLogs: Array<{ value_ids: string[]; event_date: string; metadata?: Record<string, unknown> | null }> = []

  // Also track most recent log per activity (for overdue check)
  const lastLog: Record<string, Date> = {}

  logs?.forEach(l => {
    if (l.activity_id) {
      if (!logsByActivity[l.activity_id]) logsByActivity[l.activity_id] = []
      logsByActivity[l.activity_id].push({ event_date: l.event_date, metadata: l.metadata })
      if (!lastLog[l.activity_id]) lastLog[l.activity_id] = new Date(l.event_date)
    }
    if (l.value_ids && Array.isArray(l.value_ids) && l.value_ids.length > 0) {
      directValueLogs.push({ value_ids: l.value_ids, event_date: l.event_date, metadata: l.metadata })
    }
  })

  // Duration weight: clamp(minutes / 60, 1.0, 2.0) — a 2+ hour activity contributes 2x a short one
  function durationWeight(metadata?: Record<string, unknown> | null): number {
    const dur = metadata?.duration as number | undefined
    if (!dur || dur <= 0) return 1.0
    return Math.min(2.0, Math.max(1.0, dur / 60))
  }

  const heatData: Array<{ value_id: string; heat: number }> = []
  const overdueActivityIds: string[] = []

  values?.forEach(v => {
    const vLinks = links?.filter(l => l.value_id === v.id) ?? []
    let sum = 0

    // Activity-linked contributions: sum all completions in rolling window
    vLinks.forEach(link => {
      const act = activityMap[link.activity_id]
      if (!act) return
      if (act.status === 'aspirational' || act.status === 'paused' || act.status === 'completed') return

      const strength = link.contribution_strength === 'strong' ? 1.0 : link.contribution_strength === 'moderate' ? 0.6 : 0.3
      const actLogs = logsByActivity[link.activity_id] ?? []

      for (const log of actLogs) {
        const age = (now.getTime() - new Date(log.event_date).getTime()) / (1000 * 60 * 60 * 24)
        const decay = Math.max(0, 1 - age / ROLLING_WINDOW_DAYS)
        sum += decay * strength * durationWeight(log.metadata)
      }

      // Overdue check (unchanged — uses alarm_threshold_days + most recent completion)
      const alarmDays = act.alarm_threshold_days ?? 8
      const last = lastLog[link.activity_id]
      const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : alarmDays + 1
      if (act.activity_type === 'recurring' && act.is_preventive && act.status === 'active' && daysSince >= alarmDays && !scheduledActivityIds.has(link.activity_id)) {
        if (!overdueActivityIds.includes(link.activity_id)) overdueActivityIds.push(link.activity_id)
      }
    })

    // Direct value tag contributions: log entries with this value in value_ids
    for (const log of directValueLogs) {
      if (!log.value_ids.includes(v.id)) continue
      const age = (now.getTime() - new Date(log.event_date).getTime()) / (1000 * 60 * 60 * 24)
      const decay = Math.max(0, 1 - age / ROLLING_WINDOW_DAYS)
      sum += decay * 0.6 * durationWeight(log.metadata)
    }

    // Big Outcome contributions: accomplished outcomes linked to this value
    // Uses a longer decay window (90 days) and higher base weight (~4x daily activity)
    const boLinks = boValueLinks?.filter(l => l.value_id === v.id) ?? []
    for (const link of boLinks) {
      const bo = bigOutcomes?.find(b => b.id === link.big_outcome_id)
      if (!bo?.closed_on) continue
      const age = (now.getTime() - new Date(bo.closed_on).getTime()) / (1000 * 60 * 60 * 24)
      const decay = Math.max(0, 1 - age / BIG_OUTCOME_DECAY_DAYS)
      const strength = link.contribution_strength === 'strong' ? 1.0 : link.contribution_strength === 'moderate' ? 0.6 : 0.3
      sum += decay * strength * BIG_OUTCOME_BASE_WEIGHT
    }

    // Soft-cap normalization: asymptotically approaches 1.0
    // sum ≈ 1 → heat 0.39 (score 5), sum ≈ 2 → heat 0.63 (score 7), sum ≈ 3+ → heat 0.78+ (score 8+)
    const heat = 1 - Math.exp(-sum / 2.0)
    heatData.push({ value_id: v.id, heat })
  })

  // Also catch overdue activities not linked to any value
  activities?.filter(a => a.activity_type === 'recurring' && a.is_preventive && a.status === 'active').forEach(a => {
    if (overdueActivityIds.includes(a.id)) return
    if (scheduledActivityIds.has(a.id)) return
    const alarmDays = a.alarm_threshold_days ?? 8
    const last = lastLog[a.id]
    const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : alarmDays + 1
    if (daysSince >= alarmDays) overdueActivityIds.push(a.id)
  })

  // ── Domain heat: aggregate from value heat through activities ──────────────

  // Build activity → domains map
  const activityDomains: Record<string, string[]> = {}
  domainLinks?.forEach(dl => {
    if (!activityDomains[dl.activity_id]) activityDomains[dl.activity_id] = []
    activityDomains[dl.activity_id].push(dl.domain_id)
  })

  // Build activity → values map (from the existing links data)
  const activityValues: Record<string, string[]> = {}
  links?.forEach(l => {
    if (!activityValues[l.activity_id]) activityValues[l.activity_id] = []
    activityValues[l.activity_id].push(l.value_id)
  })

  // Build value heat lookup
  const valueHeatMap = new Map(heatData.map(h => [h.value_id, h.heat]))

  // For each domain: find all linked activities, find their linked values, average the value heats
  const domainIds = new Set((domainLinks ?? []).map(dl => dl.domain_id))
  const domainHeatData: Array<{ domain_id: string; heat: number; overdue_count: number }> = []

  for (const domainId of domainIds) {
    const domainActivityIds = (domainLinks ?? [])
      .filter(dl => dl.domain_id === domainId)
      .map(dl => dl.activity_id)

    // Collect value heats from all activities in this domain
    const valueHeats: number[] = []
    for (const actId of domainActivityIds) {
      const valIds = activityValues[actId] ?? []
      for (const vid of valIds) {
        const h = valueHeatMap.get(vid)
        if (h !== undefined) valueHeats.push(h)
      }
    }

    const heat = valueHeats.length > 0
      ? valueHeats.reduce((s, h) => s + h, 0) / valueHeats.length
      : 0

    const overdueCount = domainActivityIds.filter(id => overdueActivityIds.includes(id)).length

    domainHeatData.push({ domain_id: domainId, heat, overdue_count: overdueCount })
  }

  return NextResponse.json({ heat: heatData, overdueActivityIds, domainHeat: domainHeatData })
}
