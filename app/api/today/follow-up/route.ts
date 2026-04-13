import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserToday } from '@/lib/timezone'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, parent_action_item_id = null } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const today = await getUserToday(supabase, user.id)
  const text = name.trim()

  const { data: actionItem, error } = await supabase
    .from('action_items')
    .insert({
      user_id: user.id,
      name: text,
      raw_input: text,
      source: 'follow_up',
      status: 'candidate',
      time_type: 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      enrichment_status: 'none',
      parent_action_item_id: parent_action_item_id ?? null,
    })
    .select('*, item_notes(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('action_log').insert({
    user_id: user.id,
    event_type: 'captured',
    action_item_id: actionItem.id,
    event_date: today,
    note: text,
  })

  return NextResponse.json({ actionItem }, { status: 201 })
}
