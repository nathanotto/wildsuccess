import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Upsert to ensure a row exists
  const { data, error } = await supabase
    .from('focus_settings')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select()
    .single()

  if (error) {
    // Row may already exist — try a plain select
    const { data: existing, error: selErr } = await supabase
      .from('focus_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
    return NextResponse.json(existing)
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { default_focus_minutes } = body

  if (![25, 50, 75].includes(default_focus_minutes)) {
    return NextResponse.json({ error: 'default_focus_minutes must be 25, 50, or 75' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('focus_settings')
    .upsert({ user_id: user.id, default_focus_minutes }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
