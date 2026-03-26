import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(request: NextRequest, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const kind = request.nextUrl.searchParams.get('kind')

  let query = supabase
    .from('factors')
    .select('*')
    .eq('mission_id', missionId)
    .order('kind')
    .order('sort_order')

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const factorIds = data.map((f: { id: string }) => f.id)
  const { data: links } = await supabase
    .from('coa_factor_links')
    .select('factor_id')
    .in('factor_id', factorIds.length ? factorIds : ['__none__'])

  const linkCounts: Record<string, number> = {}
  ;(links ?? []).forEach(l => {
    linkCounts[l.factor_id] = (linkCounts[l.factor_id] ?? 0) + 1
  })

  const result = data.map((f: Record<string, unknown>) => ({
    ...f,
    link_count: linkCounts[f.id as string] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const body = await request.json()
  const { kind, name } = body

  const { data: existing } = await supabase
    .from('factors')
    .select('sort_order')
    .eq('mission_id', missionId)
    .eq('kind', kind)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = existing?.length ? (existing[0].sort_order + 1) : 0

  const { data, error } = await supabase
    .from('factors')
    .insert({
      mission_id: missionId,
      user_id: user.id,
      kind,
      name,
      sort_order: nextSort,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'factor_added',
    description: `Factor added (${kind}): ${name}`,
    subject_type: 'factor',
    subject_id: data.id,
  })

  return NextResponse.json({ ...data, link_count: 0 }, { status: 201 })
}
