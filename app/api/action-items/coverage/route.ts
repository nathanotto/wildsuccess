import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Returns all (activity_id, committed_date) pairs for active action_items
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
    .from('action_items')
    .select('activity_id, committed_date')
    .eq('user_id', user.id)
    .in('status', ['committed', 'in_progress', 'completed'])
    .not('activity_id', 'is', null)
    .not('committed_date', 'is', null)
    .gte('committed_date', past.toISOString().split('T')[0])
    .lte('committed_date', future.toISOString().split('T')[0])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
