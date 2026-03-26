import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  // Fetch author names (use service role to bypass RLS — collaborators need to see each other's names)
  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const authorIds = [...new Set(data.map((f: { user_id: string }) => f.user_id))]
  const { data: profiles } = await sb
    .from('user_profiles')
    .select('id, preferred_name, full_name')
    .in('id', authorIds.length ? authorIds : ['__none__'])
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const result = data.map((f: Record<string, unknown>) => {
    const profile = profileMap.get(f.user_id as string)
    return {
      ...f,
      author_name: profile?.preferred_name || profile?.full_name || 'Unknown',
      author_full_name: profile?.full_name || profile?.preferred_name || 'Unknown',
      is_own: f.user_id === user.id,
      link_count: linkCounts[f.id as string] ?? 0,
    }
  })

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

  // Get author name for the response
  const sbPost = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await sbPost.from('user_profiles').select('preferred_name, full_name').eq('id', user.id).single()

  return NextResponse.json({ ...data, link_count: 0, author_name: profile?.preferred_name || profile?.full_name || 'You', is_own: true }, { status: 201 })
}
