import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('hopper_items')
    .select('*, activity:activities(id, name, time_type, flexibility, context, preferred_time, preferred_days, frequency, duration_range_min, duration_range_max)')
    .eq('user_id', user.id)
    .order('priority_score', { ascending: false })
    .order('proposed_date', { ascending: true, nullsFirst: false })
    .order('created_at')

  if (status) {
    query = query.eq('status', status)
    // When fetching pending items, hide future-snoozed ones beyond the view window
    if (status === 'pending') {
      const throughDate = req.nextUrl.searchParams.get('through_date')
        ?? new Date().toISOString().split('T')[0]
      query = query.or(`proposed_date.is.null,proposed_date.lte.${throughDate}`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { raw_input, source = 'quick_capture', activity_id, proposed_date, metadata, bounding_type, time_type, status: bodyStatus } = body

  if (!raw_input?.trim()) {
    return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })
  }

  const status = ['pending', 'dismissed'].includes(bodyStatus) ? bodyStatus : 'pending'

  const { data, error } = await supabase
    .from('hopper_items')
    .insert({
      user_id: user.id,
      raw_input: raw_input.trim(),
      source,
      activity_id: activity_id ?? null,
      proposed_date: proposed_date ?? null,
      metadata: metadata ?? null,
      bounding_type: bounding_type ?? 'action',
      time_type: time_type ?? 'B',
      status,
      ...(status === 'dismissed' ? { resolved_at: new Date().toISOString() } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
