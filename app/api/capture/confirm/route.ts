import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Map enrichment recurrence to Activity.frequency values
function mapRecurrence(r: string | null): string | null {
  if (!r) return null
  const map: Record<string, string> = {
    one_time: 'one_time', daily: 'daily', weekdays: 'daily',
    weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly',
    quarterly: 'quarterly', annual: 'annual',
  }
  return map[r] ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { hopper_item_id, enrichment_data } = await req.json()
  if (!hopper_item_id || !enrichment_data) {
    return NextResponse.json({ error: 'hopper_item_id and enrichment_data required' }, { status: 400 })
  }

  const ed = enrichment_data as Record<string, unknown>
  let activityId: string

  if (ed.match_type === 'existing_template' && ed.matched_activity_id) {
    // ── Path 1: link to existing activity ──────────────────────────────────
    activityId = ed.matched_activity_id as string
  } else {
    // ── Path 2: create new activity template ───────────────────────────────
    const freq = mapRecurrence(ed.suggested_recurrence as string | null)
    const { data: activity, error: actErr } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        name: ed.suggested_name,
        description: ed.suggested_description ?? null,
        activity_type: freq && freq !== 'one_time' ? 'recurring' : 'one_time',
        frequency: freq !== 'one_time' ? freq : null,
        status: 'active',
        is_preventive: ed.suggested_is_preventive ?? false,
        energy_level: ed.suggested_energy_level ?? 'B',
        emotional_weight: ed.suggested_emotional_weight ?? 'normal',
        context: ed.suggested_context ?? [],
        flexibility: ed.suggested_flexibility ?? 'anytime_this_week',
        clusterable: false,
        prep_required: false,
        depends_on_others: false,
        completion_mode: 'all',
        duration_range_min: ed.suggested_duration_min ?? null,
        duration_range_max: ed.suggested_duration_max ?? null,
        preferred_days: ed.suggested_preferred_days ?? null,
        preferred_time: ed.suggested_preferred_time ?? null,
        big_outcome_id: ed.suggested_big_outcome_id ?? null,
        source: 'template_derived',
        sort_order: 0,
      })
      .select('id')
      .single()

    if (actErr || !activity) {
      return NextResponse.json({ error: actErr?.message ?? 'Failed to create activity' }, { status: 500 })
    }
    activityId = activity.id

    // Create value links
    const valueLinks = (ed.suggested_value_links as Array<{ value_id: string; contribution_strength: string }> | null) ?? []
    if (valueLinks.length > 0) {
      await supabase.from('activity_value_links').insert(
        valueLinks.map(vl => ({
          user_id: user.id,
          activity_id: activityId,
          value_id: vl.value_id,
          contribution_strength: vl.contribution_strength ?? 'moderate',
        }))
      )
    }

    // Create domain link
    if (ed.suggested_life_domain_id) {
      await supabase.from('activity_domain_links').insert({
        user_id: user.id,
        activity_id: activityId,
        domain_id: ed.suggested_life_domain_id,
      })
    }
  }

  // Update hopper item
  const { error: updateErr } = await supabase
    .from('hopper_items')
    .update({
      activity_id: activityId,
      enrichment_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      enrichment_data: ed,
      block_type_hint: ed.suggested_block_type_id ?? null,
    })
    .eq('id', hopper_item_id)
    .eq('user_id', user.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, activity_id: activityId })
}
