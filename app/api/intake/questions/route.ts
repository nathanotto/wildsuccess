import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const seedOnly = req.nextUrl.searchParams.get('seed_only') === 'true'

  let query = supabase
    .from('intake_questions')
    .select('*')
    .order('domain_tag')
    .order('sort_order')

  if (seedOnly) {
    query = query.eq('is_seed_question', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
