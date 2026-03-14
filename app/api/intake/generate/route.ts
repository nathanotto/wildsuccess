import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateActivitySpecs } from '@/lib/activity-generation'
import type { IntakeQuestion } from '@/lib/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { question_id, response: responseValue } = body

  if (!question_id || responseValue === undefined) {
    return NextResponse.json({ error: 'question_id and response are required' }, { status: 400 })
  }

  // Load question
  const { data: question, error: qErr } = await supabase
    .from('intake_questions')
    .select('*')
    .eq('id', question_id)
    .single()
  if (qErr || !question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  // Load user's values and domains
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

  if (specs.length === 0) {
    return NextResponse.json({ activities: [] })
  }

  // Insert activities and their links
  const inserted: unknown[] = []

  for (const spec of specs) {
    const activityData = {
      user_id: user.id,
      name: spec.name,
      description: spec.description ?? null,
      activity_type: spec.activity_type,
      frequency: spec.frequency ?? null,
      status: 'active',
      is_preventive: spec.is_preventive,
      context: spec.context,
      energy_level: spec.energy_level,
      emotional_weight: spec.emotional_weight,
      flexibility: spec.flexibility,
      clusterable: spec.clusterable,
      duration_range_min: spec.duration_range_min ?? null,
      duration_range_max: spec.duration_range_max ?? null,
      source: 'template_derived',
    }

    const { data: activity, error: aErr } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single()

    if (aErr || !activity) continue

    // Domain link
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

    // Value links
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

    inserted.push(activity)
  }

  return NextResponse.json({ activities: inserted })
}
