import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ week_start: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { week_start } = await params

  // Upsert: create if doesn't exist, return existing if it does
  const { data: existing } = await supabase
    .from('weeks')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', week_start)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data: created, error } = await supabase
    .from('weeks')
    .insert({ user_id: user.id, week_start })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(created)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { week_start } = await params
  const body = await req.json()

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}

  // Handle statement fields with auto-timestamping
  if ('create_statement' in body) {
    update.create_statement = body.create_statement
    update.created_at_ritual = body.create_statement ? (body.created_at_ritual ?? now) : null
  }
  if ('complete_statement' in body) {
    update.complete_statement = body.complete_statement
    update.completed_at_ritual = body.complete_statement ? (body.completed_at_ritual ?? now) : null
  }

  // Handle timestamp toggles
  if ('organized_at' in body) update.organized_at = body.organized_at
  if ('deconflicted_at' in body) update.deconflicted_at = body.deconflicted_at
  if ('created_at_ritual' in body) update.created_at_ritual = body.created_at_ritual
  if ('completed_at_ritual' in body) update.completed_at_ritual = body.completed_at_ritual

  // Ensure the week record exists
  await supabase
    .from('weeks')
    .upsert({ user_id: user.id, week_start }, { onConflict: 'user_id,week_start' })

  const { data, error } = await supabase
    .from('weeks')
    .update(update)
    .eq('user_id', user.id)
    .eq('week_start', week_start)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
