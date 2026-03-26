import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const [{ error }, { error: error2 }] = await Promise.all([
    supabase
      .from('day_reflection')
      .update({ plan_status: 'open', closed_at: null })
      .eq('user_id', user.id)
      .eq('reflection_date', date),
    supabase
      .from('day_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('completion_date', date),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
