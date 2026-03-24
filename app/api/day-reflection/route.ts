import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('day_reflection')
    .select('*')
    .eq('user_id', user.id)
    .eq('reflection_date', date)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { reflection_date, mood_energy, journal_note, wins, friction, plan_status = 'open' } = body

  if (!reflection_date) {
    return NextResponse.json({ error: 'reflection_date is required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    user_id: user.id,
    reflection_date,
    mood_energy: mood_energy ?? null,
    journal_note: journal_note ?? null,
    wins: wins ?? null,
    friction: friction ?? null,
    plan_status,
  }
  if (plan_status === 'committed') update.committed_at = now
  if (plan_status === 'closed') update.closed_at = now

  const { data, error } = await supabase
    .from('day_reflection')
    .upsert(update, { onConflict: 'user_id,reflection_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
