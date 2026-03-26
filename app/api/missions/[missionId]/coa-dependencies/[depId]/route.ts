import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function DELETE(_request: Request, { params }: { params: Promise<{ missionId: string; depId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, depId } = await params

  const { data: dep } = await supabase.from('coa_dependencies').select('reason').eq('id', depId).single()

  const { error } = await supabase.from('coa_dependencies').delete().eq('id', depId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'dependency_removed',
    description: `Dependency removed: ${dep?.reason ?? '(unknown)'}`,
    subject_type: 'dependency',
    subject_id: depId,
  })

  return NextResponse.json({ success: true })
}
