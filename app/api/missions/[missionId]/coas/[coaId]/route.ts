import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function PATCH(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, coaId } = await params
  const body = await request.json()

  // Get current COA for status change detection
  const { data: current } = await supabase.from('coas').select('status, action').eq('id', coaId).single()

  const { data, error } = await supabase
    .from('coas')
    .update(body)
    .eq('id', coaId)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log status changes
  if (body.status && current && body.status !== current.status) {
    const entryMap: Record<string, string> = {
      completed: 'coa_completed',
      committed: 'coa_committed',
      abandoned: 'coa_abandoned',
    }
    const entryType = entryMap[body.status]
    if (entryType) {
      await writeMissionLog(supabase, {
        mission_id: missionId,
        user_id: user.id,
        entry_type: entryType,
        description: `COA ${body.status}: ${current.action}`,
        subject_type: 'coa',
        subject_id: coaId,
      })
    }
  }

  // If completed, check for aims_to_resolve factors
  let targeted_factors: unknown[] = []
  if (body.status === 'completed' && current?.status !== 'completed') {
    const { data: aimsLinks } = await supabase
      .from('coa_factor_links')
      .select('factor_id')
      .eq('coa_id', coaId)
      .eq('relationship', 'aims_to_resolve')

    if (aimsLinks?.length) {
      const factorIds = aimsLinks.map(l => l.factor_id)
      const { data: factors } = await supabase
        .from('factors')
        .select('*')
        .in('id', factorIds)
        .eq('status', 'active')
      targeted_factors = factors ?? []
    }
  }

  return NextResponse.json({ ...data, targeted_factors })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, coaId } = await params

  const { data: coa } = await supabase.from('coas').select('action').eq('id', coaId).single()

  await supabase.from('missions').update({ parent_coa_id: null }).eq('parent_coa_id', coaId)
  const { error } = await supabase.from('coas').delete().eq('id', coaId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (coa) {
    await writeMissionLog(supabase, {
      mission_id: missionId,
      user_id: user.id,
      entry_type: 'coa_abandoned',
      description: `COA deleted: ${coa.action}`,
      subject_type: 'coa',
      subject_id: coaId,
    })
  }

  return NextResponse.json({ success: true })
}
