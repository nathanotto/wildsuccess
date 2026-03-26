import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coaId } = await params

  const { data, error } = await supabase
    .from('coa_resource_needs')
    .select('*')
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
  const { description, kind, quantity, unit } = await request.json()

  const { data, error } = await supabase
    .from('coa_resource_needs')
    .insert({
      coa_id: coaId,
      description,
      kind: kind ?? 'other',
      quantity: quantity ?? null,
      unit: unit ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'resource_added',
    description: `Resource needed: ${description}`,
    subject_type: 'resource',
    subject_id: data.id,
  })

  return NextResponse.json(data, { status: 201 })
}
