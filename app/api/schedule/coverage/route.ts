import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Returns all (activity_id, scheduled_date) pairs for active schedule_items
// in the past 90 days and next 90 days. Used to compute which activities
// are already covered so the Suggested hopper section stays accurate.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const past = new Date(today); past.setDate(past.getDate() - 90)
  const future = new Date(today); future.setDate(future.getDate() + 90)

  const { data, error } = await supabase
    .from('schedule_items')
    .select('activity_id, scheduled_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .not('activity_id', 'is', null)
    .gte('scheduled_date', past.toISOString().split('T')[0])
    .lte('scheduled_date', future.toISOString().split('T')[0])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
