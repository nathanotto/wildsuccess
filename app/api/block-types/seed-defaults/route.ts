import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — idempotent seed of default block types for the current user
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.rpc('seed_default_block_types', { p_user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
