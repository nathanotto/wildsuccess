import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST body: { order: [{ id: string, sort_order: number }, ...] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { order } = body as { order: { id: string; sort_order: number }[] }

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array is required' }, { status: 400 })
  }

  // Update each block type's sort_order
  const updates = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase
        .from('block_types')
        .update({ sort_order })
        .eq('id', id)
        .eq('user_id', user.id)
    )
  )

  const err = updates.find(u => u.error)?.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
