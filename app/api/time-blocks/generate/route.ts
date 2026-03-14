import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const targetDate: string = body.target_date ?? new Date().toISOString().split('T')[0]

  // Check if blocks already exist for this date — idempotent
  const { data: existing } = await supabase
    .from('time_blocks')
    .select('id')
    .eq('user_id', user.id)
    .eq('block_date', targetDate)
    .limit(1)

  if (existing && existing.length > 0) {
    const { data: blocks } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', user.id)
      .eq('block_date', targetDate)
      .order('sort_order')
      .order('start_time')
    return NextResponse.json({ generated: false, blocks: blocks ?? [] })
  }

  // Convert date to day_of_week (0=Mon, 6=Sun — matches time_template_blocks)
  const date = new Date(targetDate + 'T12:00:00')
  const jsDay = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

  const { data: templateBlocks } = await supabase
    .from('time_template_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .order('sort_order')
    .order('start_time')

  if (!templateBlocks || templateBlocks.length === 0) {
    return NextResponse.json({ generated: false, blocks: [] })
  }

  const newBlocks = templateBlocks.map(t => ({
    user_id: user.id,
    block_date: targetDate,
    label: t.label,
    start_time: t.start_time,
    end_time: t.end_time,
    context: t.context ?? [],
    energy_level: t.energy_level,
    is_hard: false,
    sort_order: t.sort_order,
    source: 'time_template',
  }))

  const { data: created, error } = await supabase
    .from('time_blocks')
    .insert(newBlocks)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ generated: true, blocks: created ?? [] })
}
