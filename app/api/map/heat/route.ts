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
    supabase.from('action_log').select('activity_id, event_date').eq('event_type', 'completed').order('event_date', { ascending: false }),
    supabase.from('activities').select('id, activity_type, frequency, status, is_preventive'),
  ])

  const activityMap: Record<string, { activity_type: string; frequency: string | null; status: string; is_preventive: boolean }> = {}
  activities?.forEach(a => { activityMap[a.id] = a })

  // Most recent log per activity
  const lastLog: Record<string, Date> = {}
  logs?.forEach(l => {
    if (!lastLog[l.activity_id]) lastLog[l.activity_id] = new Date(l.event_date)
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
      const cadenceDays = act.activity_type === 'one_time' ? 90 : (act.frequency ? CADENCE_DAYS[act.frequency] ?? 30 : 30)
      const last = lastLog[link.activity_id]
      const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : cadenceDays + 1
      const decay = Math.max(0, 1 - daysSince / cadenceDays)

      weightedSum += decay * weight
      totalWeight += weight

      if (act.activity_type === 'recurring' && act.is_preventive && act.status === 'active' && decay === 0) {
        if (!overdueActivityIds.includes(link.activity_id)) overdueActivityIds.push(link.activity_id)
      }
    })

    heatData.push({ value_id: v.id, heat: totalWeight > 0 ? weightedSum / totalWeight : 0 })
  })

  // Also catch overdue activities not linked to any value
  activities?.filter(a => a.activity_type === 'recurring' && a.is_preventive && a.status === 'active').forEach(a => {
    if (overdueActivityIds.includes(a.id)) return
    const cadenceDays = a.frequency ? CADENCE_DAYS[a.frequency] ?? 30 : 30
    const last = lastLog[a.id]
    const daysSince = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24) : cadenceDays + 1
    if (daysSince > cadenceDays) overdueActivityIds.push(a.id)
  })

  return NextResponse.json({ heat: heatData, overdueActivityIds })
}
