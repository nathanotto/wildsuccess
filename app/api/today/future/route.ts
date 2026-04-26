import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserTimezone, localDateInTz } from '@/lib/timezone'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tz = await getUserTimezone(supabase, user.id)
  const after = req.nextUrl.searchParams.get('after') ?? localDateInTz(tz)

  // Two-week horizon
  const horizon = new Date(after + 'T12:00:00')
  horizon.setDate(horizon.getDate() + 14)
  const cutoff = horizon.toISOString().split('T')[0]

  // Fetch future committed items (committed_date > after, <= cutoff)
  const { data: committed } = await supabase
    .from('action_items')
    .select('*, item_notes(*)')
    .eq('user_id', user.id)
    .gt('committed_date', after)
    .lte('committed_date', cutoff)
    .not('status', 'in', '("completed","skipped","rescheduled","dismissed","archived")')
    .order('committed_date', { ascending: true })
    .limit(50)

  // Fetch future parked items (parked_until > after, <= cutoff)
  const { data: parked } = await supabase
    .from('action_items')
    .select('*, item_notes(*)')
    .eq('user_id', user.id)
    .eq('status', 'parked')
    .gt('parked_until', after)
    .lte('parked_until', cutoff)
    .order('parked_until', { ascending: true })
    .limit(50)

  // Merge and deduplicate
  const seen = new Set<string>()
  const items = []
  for (const item of [...(committed ?? []), ...(parked ?? [])]) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      items.push(item)
    }
  }

  // Sort by effective date (parked_until for parked, committed_date otherwise)
  items.sort((a, b) => {
    const aDate = a.status === 'parked' ? (a.parked_until ?? a.committed_date) : a.committed_date
    const bDate = b.status === 'parked' ? (b.parked_until ?? b.committed_date) : b.committed_date
    return (aDate ?? '').localeCompare(bDate ?? '')
  })

  return NextResponse.json(items.slice(0, 30))
}
