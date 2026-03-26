import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { week_start, what_worked, what_to_change, notes } = body

  if (!week_start) return NextResponse.json({ error: 'week_start required' }, { status: 400 })

  const { data, error } = await supabase
    .from('week_reflections')
    .upsert({
      user_id: user.id,
      week_start,
      what_worked: what_worked || null,
      what_to_change: what_to_change || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
