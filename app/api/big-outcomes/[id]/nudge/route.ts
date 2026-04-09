import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, time_type } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Verify the BO exists and belongs to user
  const { data: bo, error: boError } = await supabase
    .from('big_outcomes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (boError || !bo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      user_id: user.id,
      name: name.trim(),
      source: 'planning_function',
      status: 'candidate',
      big_outcome_id: id,
      time_type: time_type ?? 'B',
      emotional_weight: 'normal',
      bounding_type: 'action',
      sort_order: 0,
      enrichment_status: 'none',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
