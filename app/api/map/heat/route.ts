import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CADENCE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, annual: 365,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: values }, { data: links }, { data: logs }, { data: activities }] = await Promise.all([
    supabase.from('user_values').select('id'),
    supabase.from('activity_value_links').select('id, value_id, activity_id, contribution_strength'),
    supabase.from('action_log').select('activity_id, event_date, value_ids').in('event_type', ['completed', 'logged']).order('event_date', { ascending: false }),
    supabase.from('activities').select('id, activity_type, frequency, status, is_preventive, alarm_threshold_days'),
  ])

  const activityMap: Record<string, { activity_type: string; frequency: string | null; status: string; is_preventive: boolean; alarm_threshold_days: number }> = {}
  activities?.forEach(a => { activityMap[a.id] = a })

  // Most recent log per activity
  const lastLog: Record<string, Date> = {}
  logs?.forEach(l => {
    if (l.activity_id && !lastLog[l.activity_id]) lastLog[l.activity_id] = new Date(l.event_date)
  })

  // Direct value tags: most recent completion date per value from value_ids on action_log
  const directValueLastLog: Record<string, Date> = {}
  logs?.forEach(l => {
    if (!l.value_ids || !Array.isArray(l.value_ids)) return
    const d = new Date(l.event_date)
    for (const vid of l.value_ids) {
      if (!directValueLastLog[vid] || d > directValueLastLog[vid]) {
        directValueLastLog[vid] = d
      }
    }
  })

  const now = new Date()
  const heatData: Array<{ value_id: string; heat: number }> = []
  const overdueActivityIds: string[] = []

  values?.forEach(v => {
    const vLinks = links?.filter(l => l.value_id === v.id) ?? []
    let weightedSum = 0
    let totalWeight = 0

    vLinks.forEach(link => {
      const act = activityMap[link.activity_id]
      if (!act) return
      if (act.status === 'aspirational' || act.status === 'paused' || act.status === 'completed') return

      const weight = link.contribution_strength === 'strong' ? 1.0 : link.contribution_strength === 'moderate' ? 0.6 : 0.3
      const rawCadence = act.activity_type === 'one_time' ? 90 : (act.frequency ? CADENCE_DAYS[act.frequency] ?? 30 : 30)
      const cadenceDays = Math.max(3, rawCadence) // floor of 3 days so daily activities don't zero out overnight
      const last = lastLog[link.activity_id]
      const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : cadenceDays + 1
      const decay = Math.max(0, 1 - daysSince / cadenceDays)

      // Only count activities that have at least one completion — never-completed activities don't drag the average down
      if (last) {
        weightedSum += decay * weight
        totalWeight += weight
      }

      // Overdue check uses alarm_threshold_days (independent of cadence)
      const alarmDays = act.alarm_threshold_days ?? 8
      if (act.activity_type === 'recurring' && act.is_preventive && act.status === 'active' && daysSince >= alarmDays) {
        if (!overdueActivityIds.includes(link.activity_id)) overdueActivityIds.push(link.activity_id)
      }
    })

    // Add contribution from direct value tags (one-off items without activity_id)
    const directLast = directValueLastLog[v.id]
    if (directLast) {
      const daysSince = (now.getTime() - directLast.getTime()) / (1000 * 60 * 60 * 24)
      const decay = Math.max(0, 1 - daysSince / 14) // 14-day decay window for direct tags
      const weight = 0.6 // moderate contribution
      weightedSum += decay * weight
      totalWeight += weight
    }

    heatData.push({ value_id: v.id, heat: totalWeight > 0 ? weightedSum / totalWeight : 0 })
  })

  // Also catch overdue activities not linked to any value
  activities?.filter(a => a.activity_type === 'recurring' && a.is_preventive && a.status === 'active').forEach(a => {
    if (overdueActivityIds.includes(a.id)) return
    const alarmDays = a.alarm_threshold_days ?? 8
    const last = lastLog[a.id]
    const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : alarmDays + 1
    if (daysSince >= alarmDays) overdueActivityIds.push(a.id)
  })

  return NextResponse.json({ heat: heatData, overdueActivityIds })
}
