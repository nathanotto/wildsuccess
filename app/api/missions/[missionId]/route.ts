import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function PATCH(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const body = await request.json()

  const { data: current } = await supabase.from('missions').select('status, name').eq('id', missionId).single()

  const { data, error } = await supabase
    .from('missions')
    .update(body)
    .eq('id', missionId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status && current && body.status !== current.status) {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'mission_status_changed',
      description: `Mission status changed from ${current.status} to ${body.status}`,
      subject_type: 'mission',
      subject_id: missionId,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const { error } = await supabase.from('missions').delete().eq('id', missionId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
