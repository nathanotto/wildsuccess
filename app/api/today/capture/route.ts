import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raw_input, source_schedule_item_id = null } = await req.json()
  if (!raw_input?.trim()) return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const text = raw_input.trim()

  // Create hopper_item as provenance record (activated immediately — no need to sit in hopper)
  const { data: hopperItem, error: hopperError } = await supabase
    .from('hopper_items')
    .insert({
      user_id: user.id,
      raw_input: text,
      source: 'quick_capture',
      source_schedule_item_id,
      status: 'activated',
      priority_score: 0,
      priority_tier: 'normal',
      bounding_type: 'action',
      time_type: 'B',
      enrichment_status: 'none',
      proposed_date: today,
      resolved_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (hopperError) return NextResponse.json({ error: hopperError.message }, { status: 500 })

  // Create schedule_item for today — this is what appears on the Today list
  const { data: scheduleItem, error: scheduleError } = await supabase
    .from('schedule_items')
    .insert({
      user_id: user.id,
      hopper_item_id: hopperItem.id,
      source_schedule_item_id,
      name: text,
      scheduled_date: today,
      scheduled_time: null,
      flexibility: 'anytime_today',
      context: [],
      time_type: 'B',
      emotional_weight: 'normal',
      bounding_type: 'action',
      status: 'active',
      sort_order: 9999, // lands at bottom of to-do list
    })
    .select('*, item_notes(*)')
    .single()

  if (scheduleError) return NextResponse.json({ error: scheduleError.message }, { status: 500 })

  await supabase.from('action_log').insert({
    user_id: user.id,
    event_type: 'captured',
    hopper_item_id: hopperItem.id,
    schedule_item_id: scheduleItem.id,
    event_date: today,
    note: text,
  })

  return NextResponse.json({ hopperItem, scheduleItem }, { status: 201 })
}
