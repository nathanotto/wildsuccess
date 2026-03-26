import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coaId } = await params
  const { data, error } = await supabase
    .from('commitments')
    .select('*, user_profiles!commitments_user_id_fkey(preferred_name, full_name)')
    .eq('coa_id', coaId)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map(c => ({
    ...c,
    user_name: (c.user_profiles as { preferred_name: string | null; full_name: string | null } | null)?.preferred_name
      || (c.user_profiles as { preferred_name: string | null; full_name: string | null } | null)?.full_name || 'Unknown',
    user_profiles: undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId, coaId } = await params
  const { description, deadline } = await request.json()

  const { data, error } = await supabase
    .from('commitments')
    .insert({
      coa_id: coaId,
      mission_id: missionId,
      user_id: user.id,
      description: description || null,
      deadline: deadline || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase.from('user_profiles').select('preferred_name').eq('id', user.id).single()

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'commitment_made',
    description: `${profile?.preferred_name || 'User'} committed to COA`,
    subject_type: 'coa',
    subject_id: coaId,
  })

  return NextResponse.json(data, { status: 201 })
}
