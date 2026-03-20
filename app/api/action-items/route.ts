import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams

  let query = supabase
    .from('action_items')
    .select('*, item_notes(*)')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('committed_date', { ascending: true, nullsFirst: false })
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  const status = sp.get('status')
  if (status) query = query.eq('status', status)

  const committedDate = sp.get('committed_date')
  if (committedDate) query = query.eq('committed_date', committedDate)

  const proposedDateStart = sp.get('proposed_date_start')
  const proposedDateEnd = sp.get('proposed_date_end')
  if (proposedDateStart) query = query.gte('proposed_date', proposedDateStart)
  if (proposedDateEnd) query = query.lte('proposed_date', proposedDateEnd)

  const itemType = sp.get('item_type')
  if (itemType) query = query.eq('item_type', itemType)

  const parentId = sp.get('parent_action_item_id')
  if (parentId) query = query.eq('parent_action_item_id', parentId)

  const rangeStart = sp.get('range_start')
  const rangeEnd = sp.get('range_end')
  if (rangeStart && rangeEnd) {
    query = query.gte('committed_date', rangeStart).lte('committed_date', rangeEnd)
  }

  // For candidates, optionally exclude future-snoozed items
  if (status === 'candidate') {
    const throughDate = sp.get('through_date')
    if (throughDate) {
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

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      user_id: user.id,
      ...body,
      name: body.name.trim(),
    })
    .select('*, item_notes(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
