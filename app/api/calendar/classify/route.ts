import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('calendar_event_classifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { match_key, match_type, classification, display_label, energy_level, life_domain_id, notes } = body

  if (!match_key || !match_type || !classification) {
    return NextResponse.json({ error: 'match_key, match_type, and classification are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('calendar_event_classifications')
    .upsert({
      user_id: user.id,
      match_key,
      match_type,
      classification,
      display_label: display_label ?? null,
      energy_level: energy_level ?? null,
      life_domain_id: life_domain_id ?? null,
      notes: notes ?? null,
    }, { onConflict: 'user_id,match_key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
