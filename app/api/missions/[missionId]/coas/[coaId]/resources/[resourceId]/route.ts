import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function PATCH(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string; resourceId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, resourceId } = await params
  const body = await request.json()

  const { data: current } = await supabase.from('coa_resource_needs').select('description, status').eq('id', resourceId).single()

  const { data, error } = await supabase
    .from('coa_resource_needs')
    .update(body)
    .eq('id', resourceId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === 'met' && current?.status !== 'met') {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'resource_met',
      description: `Resource met: ${current?.description ?? data.description}`,
      subject_type: 'resource',
      subject_id: resourceId,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string; resourceId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resourceId } = await params

  const { error } = await supabase.from('coa_resource_needs').delete().eq('id', resourceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
