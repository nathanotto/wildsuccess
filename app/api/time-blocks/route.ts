import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date')
  const rangeStart = sp.get('range_start')
  const rangeEnd = sp.get('range_end')

  let query = supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', user.id)
    .order('block_date')
    .order('sort_order')
    .order('start_time', { ascending: true, nullsFirst: true })

  if (date) query = query.eq('block_date', date)
  else if (rangeStart && rangeEnd) query = query.gte('block_date', rangeStart).lte('block_date', rangeEnd)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { block_date, label, start_time, end_time, energy_level = 'B', is_hard = false, sort_order = 0, source = 'manual', context = [] } = body

  if (!block_date || !label) {
    return NextResponse.json({ error: 'block_date and label are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      user_id: user.id,
      block_date,
      label,
      start_time: start_time ?? null,
      end_time: end_time ?? null,
      energy_level,
      is_hard,
      sort_order,
      source,
      context,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
