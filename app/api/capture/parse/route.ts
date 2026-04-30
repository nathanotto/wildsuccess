import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parseCapture, UserContext } from '@/lib/capture-parser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawInput } = await req.json()
  if (!rawInput?.trim()) return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })

  const [peopleRes, activitiesRes, suggestionsRes, profileRes, valuesRes] = await Promise.all([
    supabase
      .from('known_people')
      .select('id, name, normalized_name, mention_count, known_people_value_links(value_id, contribution_strength, user_values(name))')
      .eq('user_id', user.id)
      .order('mention_count', { ascending: false }),
    supabase
      .from('activities')
      .select('id, name, time_type, activity_value_links(value_id, contribution_strength, user_values(name))')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('task_suggestions')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('user_profiles')
      .select('full_name, preferred_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_values')
      .select('id, name')
      .eq('user_id', user.id),
  ])

  const ctx: UserContext = {
    knownPeople: (peopleRes.data ?? []).map((p: any) => ({
      id: p.id, name: p.name, normalizedName: p.normalized_name, mentionCount: p.mention_count,
      valueLinks: (p.known_people_value_links ?? []).map((vl: any) => ({ valueId: vl.value_id, valueName: vl.user_values?.name ?? '', strength: vl.contribution_strength })),
    })),
    activities: (activitiesRes.data ?? []).map((a: any) => ({
      id: a.id, name: a.name, normalizedName: a.name.toLowerCase().trim(), timeType: a.time_type,
      valueLinks: (a.activity_value_links ?? []).map((vl: any) => ({ valueId: vl.value_id, valueName: vl.user_values?.name ?? '', strength: vl.contribution_strength })),
    })),
    taskSuggestions: (suggestionsRes.data ?? []).map((t: any) => ({ id: t.id, name: t.name, normalizedName: t.name.toLowerCase().trim() })),
    values: (valuesRes.data ?? []).map((v: any) => ({ id: v.id, name: v.name, normalizedName: v.name.toLowerCase().trim() })),
    userName: profileRes.data?.preferred_name ?? profileRes.data?.full_name ?? '',
  }

  const parsed = parseCapture(rawInput.trim(), ctx, new Date())
  return NextResponse.json({ parsed })
}
