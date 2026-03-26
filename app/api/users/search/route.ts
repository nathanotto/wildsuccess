import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')
  if (!q?.trim()) return NextResponse.json([])

  const { data } = await supabase
    .from('user_profiles')
    .select('id, preferred_name, full_name')
    .or(`preferred_name.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(10)

  return NextResponse.json(data ?? [])
}
