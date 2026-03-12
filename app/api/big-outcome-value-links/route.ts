import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { big_outcome_id, value_id, contribution_strength } = body

  const { data, error } = await supabase
    .from('big_outcome_value_links')
    .insert({ user_id: user.id, big_outcome_id, value_id, contribution_strength: contribution_strength ?? 'moderate' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
