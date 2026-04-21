import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(request: NextRequest, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const sp = request.nextUrl.searchParams
  const subjectType = sp.get('subject_type')
  const entryType = sp.get('entry_type')

  const subjectId = sp.get('subject_id')

  let query = supabase
    .from('mission_log')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false })

  if (subjectType) query = query.eq('subject_type', subjectType)
  if (subjectId) query = query.eq('subject_id', subjectId)
  if (entryType) query = query.eq('entry_type', entryType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const { description, subject_type, subject_id } = await request.json()

  if (!description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'note',
    description: description.trim(),
    subject_type: subject_type ?? undefined,
    subject_id: subject_id ?? undefined,
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
