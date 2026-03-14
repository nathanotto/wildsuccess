import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('block_types')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color, default_duration_minutes = 60, energy_level = 'B', icon, sort_order = 0 } = body

  if (!name?.trim() || !color) {
    return NextResponse.json({ error: 'name and color are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('block_types')
    .insert({
      user_id: user.id,
      name: name.trim(),
      color,
      default_duration_minutes,
      energy_level,
      icon: icon ?? null,
      sort_order,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
