import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { hopper_item_id } = await req.json()
  if (!hopper_item_id) return NextResponse.json({ error: 'hopper_item_id required' }, { status: 400 })

  const { error } = await supabase
    .from('hopper_items')
    .update({ enrichment_status: 'declined' })
    .eq('id', hopper_item_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
