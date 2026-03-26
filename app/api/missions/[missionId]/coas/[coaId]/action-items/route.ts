import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coaId } = await params
  const { data, error } = await supabase
    .from('action_items')
    .select('id, name, status, user_id, assigned_to, created_at')
    .eq('coa_id', coaId)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, coaId } = await params
  const { name, description, assigned_to } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description || null,
      coa_id: coaId,
      mission_id: missionId,
      assigned_to: assigned_to === null ? null : (assigned_to || user.id),
      source: 'planning_function',
      item_type: 'task',
      status: 'candidate',
      time_type: 'B',
      flexibility: 'anytime_this_week',
      emotional_weight: 'normal',
      bounding_type: 'action',
      priority_score: 50,
      priority_tier: 'normal',
      sort_order: 0,
      enrichment_status: 'none',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'note',
    description: `Action item created on COA: ${name.trim()}`,
    subject_type: 'coa',
    subject_id: coaId,
  })

  return NextResponse.json(data, { status: 201 })
}
