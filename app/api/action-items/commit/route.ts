import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/action-items/commit — commit all uncommitted action_items for a given date
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await req.json()
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const now = new Date().toISOString()

  // Fetch uncommitted action_items for this date
  const { data: items, error: fetchErr } = await supabase
    .from('action_items')
    .select('id, activity_id')
    .eq('user_id', user.id)
    .eq('committed_date', date)
    .not('status', 'in', '("committed","completed","in_progress")')
    .is('committed_at', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ committed: 0 })

  const ids = items.map(i => i.id)

  // Set committed_at and status on all items
  const { error: updateErr } = await supabase
    .from('action_items')
    .update({ committed_at: now, status: 'committed' })
    .in('id', ids)
    .eq('user_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Write action_log events
  const logRows = items.map(item => ({
    user_id: user.id,
    event_type: 'committed' as const,
    action_item_id: item.id,
    activity_id: item.activity_id ?? null,
    event_date: date,
  }))
  await supabase.from('action_log').insert(logRows)

  // Update day_reflection
  await supabase
    .from('day_reflections')
    .upsert({
      user_id: user.id,
      reflection_date: date,
      plan_status: 'committed',
      committed_at: now,
    }, { onConflict: 'user_id,reflection_date' })

  return NextResponse.json({ committed: ids.length })
}
