import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_input, source_schedule_item_id } = await req.json()
  if (!raw_input?.trim()) return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hopper_items')
    .insert({
      user_id: user.id,
      raw_input: raw_input.trim(),
      source: 'quick_capture',
      status: 'pending',
      priority_score: 0,
      priority_tier: 'normal',
      bounding_type: 'action',
      time_type: 'B',
      enrichment_status: 'none',
      proposed_date: new Date().toISOString().split('T')[0],
      source_schedule_item_id: source_schedule_item_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('action_log').insert({
    user_id: user.id,
    event_type: 'captured',
    hopper_item_id: data.id,
    schedule_item_id: source_schedule_item_id ?? null,
    event_date: new Date().toISOString().split('T')[0],
    note: raw_input.trim(),
  })

  return NextResponse.json(data, { status: 201 })
}
