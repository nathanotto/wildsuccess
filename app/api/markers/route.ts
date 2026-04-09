import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  let query = supabase
    .from('markers')
    .select('*')
    .eq('user_id', user.id)
    .order('occurred_on', { ascending: false })

  const subjectType = sp.get('subject_type')
  if (subjectType) query = query.eq('subject_type', subjectType)

  const subjectId = sp.get('subject_id')
  if (subjectId) query = query.eq('subject_id', subjectId)

  const since = sp.get('since')
  if (since) query = query.gte('occurred_on', since)

  const until = sp.get('until')
  if (until) query = query.lte('occurred_on', until)

  const reflectionStatus = sp.get('reflection_status')
  if (reflectionStatus) query = query.eq('reflection_status', reflectionStatus)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { occurred_on, subject_type, subject_id, subject_title_snapshot, marker_type, title, in_moment_note, succeeded_by_type, succeeded_by_id } = body

  if (!occurred_on || !marker_type || !title || !subject_title_snapshot) {
    return NextResponse.json({ error: 'occurred_on, marker_type, title, and subject_title_snapshot are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('markers')
    .insert({
      user_id: user.id,
      occurred_on,
      subject_type: subject_type ?? null,
      subject_id: subject_id ?? null,
      subject_title_snapshot,
      marker_type,
      title,
      in_moment_note: in_moment_note ?? null,
      succeeded_by_type: succeeded_by_type ?? null,
      succeeded_by_id: succeeded_by_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
