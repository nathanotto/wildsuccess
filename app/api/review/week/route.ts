import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = req.nextUrl.searchParams.get('week_start')
  if (!weekStart) return NextResponse.json({ error: 'week_start is required' }, { status: 400 })

  // Compute week end (Sunday)
  const startDate = new Date(weekStart + 'T12:00:00')
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const weekEnd = endDate.toISOString().split('T')[0]

  const [
    itemsRes,
    timeBlocksRes,
    reflectionsRes,
    loggedRes,
    spansRes,
    weekReflectionRes,
    valuesRes,
    activityLinksRes,
    taskLinksRes,
    actionItemLinksRes,
  ] = await Promise.all([
    // Action items committed this week
    supabase
      .from('action_items')
      .select('id, name, status, scheduled_time, completed_at, time_type, activity_id, task_suggestion_id')
      .eq('user_id', user.id)
      .gte('committed_date', weekStart)
      .lte('committed_date', weekEnd)
      .order('committed_date'),
    // Time blocks for time balance
    supabase
      .from('time_blocks')
      .select('time_type, duration_minutes, start_time, end_time')
      .eq('user_id', user.id)
      .gte('block_date', weekStart)
      .lte('block_date', weekEnd),
    // Daily reflections for mood, wins, friction
    supabase
      .from('day_reflection')
      .select('reflection_date, mood_energy, wins, friction')
      .eq('user_id', user.id)
      .gte('reflection_date', weekStart)
      .lte('reflection_date', weekEnd)
      .order('reflection_date'),
    // Logged items
    supabase
      .from('action_log')
      .select('id, note, event_date, created_at')
      .eq('user_id', user.id)
      .eq('event_type', 'logged')
      .gte('event_date', weekStart)
      .lte('event_date', weekEnd)
      .order('created_at'),
    // Day spans overlapping this week
    supabase
      .from('day_spans')
      .select('id, name, start_date, end_date, color, person_id')
      .eq('user_id', user.id)
      .lte('start_date', weekEnd)
      .gte('end_date', weekStart),
    // Week reflection
    supabase
      .from('week_reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle(),
    // Values for effort computation
    supabase
      .from('user_values')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true),
    // Value links for effort
    supabase
      .from('activity_value_links')
      .select('value_id, contribution_strength, activity_id')
      .eq('user_id', user.id),
    supabase
      .from('task_suggestion_value_links')
      .select('value_id, contribution_strength, task_suggestion_id')
      .eq('user_id', user.id),
    supabase
      .from('action_item_value_links')
      .select('value_id, contribution_strength, action_item_id')
      .eq('user_id', user.id),
  ])

  const allItems = itemsRes.data ?? []
  const completed = allItems.filter(i => i.status === 'completed')
  const incomplete = allItems.filter(i => ['committed', 'in_progress', 'skipped', 'rescheduled', 'parked'].includes(i.status))
  const total = completed.length + incomplete.length
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0

  // Time balance from time_blocks
  const timeBalance: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, '0': 0 }
  for (const tb of (timeBlocksRes.data ?? [])) {
    const dur = tb.duration_minutes ?? (tb.start_time && tb.end_time
      ? (toMin(tb.end_time) - toMin(tb.start_time))
      : 0)
    if (tb.time_type && tb.time_type in timeBalance) {
      timeBalance[tb.time_type] += dur
    }
  }

  // Mood arc
  const moods: { date: string; mood_energy: number | null }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const ds = d.toISOString().split('T')[0]
    const ref = (reflectionsRes.data ?? []).find(r => r.reflection_date === ds)
    moods.push({ date: ds, mood_energy: ref?.mood_energy ?? null })
  }

  // Daily wins and friction
  const dailyWins = (reflectionsRes.data ?? [])
    .filter(r => r.wins)
    .map(r => ({ date: r.reflection_date, wins: r.wins! }))
  const dailyFriction = (reflectionsRes.data ?? [])
    .filter(r => r.friction)
    .map(r => ({ date: r.reflection_date, friction: r.friction! }))

  // Values effort for this week — computed from completed items
  const strengthWeight = (s: string) => s === 'strong' ? 1.0 : s === 'moderate' ? 0.6 : 0.3
  const activityToValues: Record<string, { value_id: string; weight: number }[]> = {}
  for (const al of (activityLinksRes.data ?? [])) {
    if (!activityToValues[al.activity_id]) activityToValues[al.activity_id] = []
    activityToValues[al.activity_id].push({ value_id: al.value_id, weight: strengthWeight(al.contribution_strength) })
  }
  const taskToValues: Record<string, { value_id: string; weight: number }[]> = {}
  for (const tl of (taskLinksRes.data ?? [])) {
    if (!taskToValues[tl.task_suggestion_id]) taskToValues[tl.task_suggestion_id] = []
    taskToValues[tl.task_suggestion_id].push({ value_id: tl.value_id, weight: strengthWeight(tl.contribution_strength) })
  }
  const itemToValues: Record<string, { value_id: string; weight: number }[]> = {}
  for (const il of (actionItemLinksRes.data ?? [])) {
    if (!itemToValues[il.action_item_id]) itemToValues[il.action_item_id] = []
    itemToValues[il.action_item_id].push({ value_id: il.value_id, weight: strengthWeight(il.contribution_strength) })
  }

  const effortMap: Record<string, number> = {}
  for (const item of completed) {
    const links = [
      ...(itemToValues[item.id] ?? []),
      ...(item.activity_id ? (activityToValues[item.activity_id] ?? []) : []),
      ...(item.task_suggestion_id ? (taskToValues[item.task_suggestion_id] ?? []) : []),
    ]
    for (const { value_id, weight } of links) {
      effortMap[value_id] = (effortMap[value_id] ?? 0) + weight
    }
  }

  const values = valuesRes.data ?? []
  const valueEffort = values
    .map(v => ({ value_id: v.id, value_name: v.name, effort: Math.round((effortMap[v.id] ?? 0) * 10) / 10 }))
    .filter(v => v.effort > 0)

  // Week label
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const weekLabel = startDate.getMonth() === endDate.getMonth()
    ? `${months[startDate.getMonth()]} ${startDate.getDate()}–${endDate.getDate()}`
    : `${months[startDate.getMonth()]} ${startDate.getDate()} – ${months[endDate.getMonth()]} ${endDate.getDate()}`

  return NextResponse.json({
    completed: completed.map(i => ({ id: i.id, name: i.name, completed_at: i.completed_at })),
    incomplete: incomplete.map(i => ({ id: i.id, name: i.name, status: i.status })),
    completionRate,
    completedCount: completed.length,
    totalCount: total,
    timeBalance,
    moods,
    dailyWins,
    dailyFriction,
    logged: loggedRes.data ?? [],
    spans: spansRes.data ?? [],
    valueEffort,
    reflection: weekReflectionRes.data ?? null,
    metadata: { weekStart, weekEnd, weekLabel },
  })
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
