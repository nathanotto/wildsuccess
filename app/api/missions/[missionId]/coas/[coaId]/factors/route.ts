import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coaId } = await params

  const { data, error } = await supabase
    .from('coa_factor_links')
    .select('factor_id, relationship')
    .eq('coa_id', coaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// Toggle behavior: if link exists with same relationship, delete; different relationship, update; no link, create
export async function POST(request: Request, { params }: { params: Promise<{ missionId: string; coaId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { coaId } = await params
  const { factor_id, relationship } = await request.json()
  const rel = relationship ?? 'accounts_for'

  const { data: existing } = await supabase
    .from('coa_factor_links')
    .select('id, relationship')
    .eq('coa_id', coaId)
    .eq('factor_id', factor_id)
    .limit(1)

  if (existing?.length) {
    if (existing[0].relationship === rel) {
      // Same relationship — unlink
      await supabase.from('coa_factor_links').delete().eq('id', existing[0].id)
      return NextResponse.json({ action: 'unlinked' })
    } else {
      // Different relationship — update
      await supabase.from('coa_factor_links').update({ relationship: rel }).eq('id', existing[0].id)
      return NextResponse.json({ action: 'updated', relationship: rel })
    }
  } else {
    const { data, error } = await supabase
      .from('coa_factor_links')
      .insert({ coa_id: coaId, factor_id, relationship: rel })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'linked', link: data }, { status: 201 })
  }
}
