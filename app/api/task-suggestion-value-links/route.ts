import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/task-suggestion-value-links?task_suggestion_id=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const taskSuggestionId = req.nextUrl.searchParams.get('task_suggestion_id')
  if (!taskSuggestionId) return NextResponse.json({ error: 'task_suggestion_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('task_suggestion_value_links')
    .select('*')
    .eq('user_id', user.id)
    .eq('task_suggestion_id', taskSuggestionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/task-suggestion-value-links
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { task_suggestion_id, value_id, contribution_strength = 'moderate' } = body

  if (!task_suggestion_id || !value_id) {
    return NextResponse.json({ error: 'task_suggestion_id and value_id are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('task_suggestion_value_links')
    .upsert({
      user_id: user.id,
      task_suggestion_id,
      value_id,
      contribution_strength,
    }, { onConflict: 'task_suggestion_id,value_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
