import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function PATCH(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string; commitmentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, commitmentId } = await params
  const body = await request.json()

  if (body.status === 'completed') body.completed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('commitments')
    .update(body)
    .eq('id', commitmentId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === 'completed') {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'coa_committed',
      description: `Commitment completed${body.completion_note ? ': ' + body.completion_note : ''}`,
      subject_type: 'coa',
      subject_id: data.coa_id,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string; commitmentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commitmentId } = await params
  const { error } = await supabase.from('commitments').delete().eq('id', commitmentId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
