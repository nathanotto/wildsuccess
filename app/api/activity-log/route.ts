import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const activity_id = searchParams.get('activity_id')

  let query = supabase.from('activity_log').select('*').order('performed_at', { ascending: false })
  if (activity_id) query = query.eq('activity_id', activity_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { activity_id, performed_at, note, duration_minutes } = body

  const { data, error } = await supabase
    .from('activity_log')
    .insert({ user_id: user.id, activity_id, performed_at: performed_at ?? new Date().toISOString(), note, duration_minutes })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
