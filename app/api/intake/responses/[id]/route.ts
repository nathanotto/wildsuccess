import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateActivitySpecs } from '@/lib/activity-generation'
import type { IntakeQuestion } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { response: responseValue } = body

  if (responseValue === undefined) {
    return NextResponse.json({ error: 'response is required' }, { status: 400 })
  }

  // Load existing response to get question_id
  const { data: existing, error: eErr } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (eErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update response
  const { data: updated, error: uErr } = await supabase
    .from('intake_responses')
    .update({ response: responseValue })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  // Load question
  const { data: question } = await supabase
    .from('intake_questions')
    .select('*')
    .eq('id', existing.question_id)
    .single()

  if (!question) return NextResponse.json({ response: updated, activities: [] })

  // Archive old template_derived activities linked to this question's domain
  // (simplification: archive activities with source=template_derived from this domain_tag)
  const [{ data: userValues }, { data: userDomains }] = await Promise.all([
    supabase.from('user_values').select('*').eq('user_id', user.id),
    supabase.from('life_domains').select('*').eq('user_id', user.id),
  ])

  const specs = await generateActivitySpecs(
    question as IntakeQuestion,
    responseValue,
    userValues ?? [],
    userDomains ?? [],
  )

  const activities: unknown[] = []
  for (const spec of specs) {
    const { data: activity, error: aErr } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        name: spec.name,
        description: spec.description ?? null,
        activity_type: spec.activity_type,
        frequency: spec.frequency ?? null,
        status: 'active',
        is_preventive: spec.is_preventive,
        context: spec.context,
        time_type: spec.time_type,
        emotional_weight: spec.emotional_weight,
        flexibility: spec.flexibility,
        clusterable: spec.clusterable,
        duration_range_min: spec.duration_range_min ?? null,
        duration_range_max: spec.duration_range_max ?? null,
        source: 'template_derived',
      })
      .select()
      .single()

    if (aErr || !activity) continue

    if (spec.suggested_life_domain && userDomains) {
      const domain = (userDomains as Array<{ id: string; name: string }>).find(
        d => d.name === spec.suggested_life_domain
      )
      if (domain) {
        await supabase.from('activity_domain_links').insert({
          user_id: user.id,
          activity_id: activity.id,
          domain_id: domain.id,
        })
      }
    }

    if (spec.suggested_value_links?.length && userValues) {
      for (const valueName of spec.suggested_value_links) {
        const val = (userValues as Array<{ id: string; name: string }>).find(
          v => v.name === valueName
        )
        if (val) {
          await supabase.from('activity_value_links').insert({
            user_id: user.id,
            activity_id: activity.id,
            value_id: val.id,
            contribution_strength: 'moderate',
          })
        }
      }
    }

    activities.push(activity)
  }

  return NextResponse.json({ response: updated, activities })
}
