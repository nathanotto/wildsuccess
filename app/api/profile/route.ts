import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Build update object from only the fields present in the request
  const allowedFields = ['full_name', 'preferred_name', 'display_name', 'intake_status', 'intake_progress', 'timezone', 'communication_preferences'] as const
  const update: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
