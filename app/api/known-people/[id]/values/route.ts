import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: person_id } = await params
  const { value_id, contribution_strength = 'moderate' } = await req.json()
  if (!value_id) return NextResponse.json({ error: 'value_id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('known_people_value_links')
    .insert({ user_id: user.id, person_id, value_id, contribution_strength })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
