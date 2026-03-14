import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('id, provider, calendar_ids, is_active, last_synced_at, created_at')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()

  return NextResponse.json({
    connected: !!conn,
    connection: conn ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { calendar_ids } = body

  const { data, error } = await supabase
    .from('calendar_connections')
    .update({ calendar_ids })
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
