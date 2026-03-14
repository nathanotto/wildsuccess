import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// day_of_week: 0=Monday, 6=Sunday
const DEFAULT_BLOCKS = [
  // Weekdays Mon–Fri
  ...[0, 1, 2, 3, 4].flatMap(d => [
    { day_of_week: d, label: 'Morning Focus',      start_time: '08:00', end_time: '10:00', energy_level: 'A', sort_order: 0 },
    { day_of_week: d, label: 'Comms & Calls',       start_time: '10:00', end_time: '11:00', energy_level: 'B', sort_order: 1 },
    { day_of_week: d, label: 'Deep Work',            start_time: '11:00', end_time: '12:30', energy_level: 'A', sort_order: 2 },
    { day_of_week: d, label: 'Lunch',                start_time: '12:30', end_time: '13:30', energy_level: 'C', sort_order: 3 },
    { day_of_week: d, label: 'Computer Time',        start_time: '13:30', end_time: '16:00', energy_level: 'B', sort_order: 4 },
    { day_of_week: d, label: 'Buffer / Wind Down',   start_time: '16:00', end_time: '17:00', energy_level: 'C', sort_order: 5 },
  ]),
  // Saturday
  { day_of_week: 5, label: 'Open Morning',           start_time: '08:00', end_time: '12:00', energy_level: 'C', sort_order: 0 },
  { day_of_week: 5, label: 'Open Afternoon',         start_time: '12:00', end_time: '17:00', energy_level: 'C', sort_order: 1 },
  // Sunday
  { day_of_week: 6, label: 'Reflective Morning',     start_time: '08:00', end_time: '10:00', energy_level: 'C', sort_order: 0 },
  { day_of_week: 6, label: 'Open Day',               start_time: '10:00', end_time: '17:00', energy_level: 'C', sort_order: 1 },
  { day_of_week: 6, label: 'Week Review & Plan',     start_time: '19:00', end_time: '20:00', energy_level: 'B', sort_order: 2 },
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Idempotent — skip if already has template
  const { data: existing } = await supabase
    .from('time_template_blocks')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ skipped: true, message: 'Template already exists' })
  }

  const rows = DEFAULT_BLOCKS.map(b => ({ ...b, user_id: user.id, context: [] }))
  const { data, error } = await supabase
    .from('time_template_blocks')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data?.length ?? 0 })
}
