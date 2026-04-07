import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ROLLING_WINDOW_DAYS = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() - ROLLING_WINDOW_DAYS)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  const [{ data: values }, { data: links }, { data: logs }, { data: activities }, { data: scheduledItems }] = await Promise.all([
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

  return NextResponse.json({ heat: heatData, overdueActivityIds })
}
