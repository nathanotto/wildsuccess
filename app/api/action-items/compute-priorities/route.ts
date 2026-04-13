import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getUserTimezone, localDateInTz, localDateOffsetInTz } from '@/lib/timezone'

// POST — compute priority_score and priority_tier for all candidate action_items
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tz = await getUserTimezone(supabase, user.id)
  const today = localDateInTz(tz)
  const threeDaysOut = localDateOffsetInTz(tz, 3)
  const weekOut = localDateOffsetInTz(tz, 7)

  // Fetch candidate action_items with their activity context
  const { data: items, error } = await supabase
    .from('action_items')
    .select(`
      id,
      source,
      proposed_date,
      activity:activities(
        id,
        emotional_weight,
        time_type,
        flexibility,
        value_links:activity_value_links(
          value_id,
          contribution_strength,
          value:user_values(score, sufficiency_mark, layer)
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'candidate')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ updated: 0 })

  const LAYER_MULT: Record<string, number> = { safety: 4, security: 3, freedom: 2, opportunity: 1 }

  const updates = items.map(item => {
    let score = 0

    // Deadline proximity (40% weight)
    if (item.proposed_date) {
      if (item.proposed_date < today) {
        score += 40 // overdue
      } else if (item.proposed_date <= threeDaysOut) {
        score += 30 // due within 3 days
      } else if (item.proposed_date <= weekOut) {
        score += 20 // due this week
      }
    }

    // Value urgency (30% weight) — items serving underperforming values get boost
    const activity = item.activity as {
      emotional_weight?: string
      time_type?: string
      flexibility?: string
      value_links?: Array<{
        contribution_strength: string
        value?: { score: number; sufficiency_mark: number; layer: string }
      }>
    } | null

    if (activity?.value_links?.length) {
      const valueBoost = activity.value_links.reduce((acc, vl) => {
        const v = vl.value
        if (!v) return acc
        const gap = v.sufficiency_mark - v.score
        if (gap > 0) {
          const strengthMult = vl.contribution_strength === 'strong' ? 3 : vl.contribution_strength === 'moderate' ? 2 : 1
          const layerMult = LAYER_MULT[v.layer] ?? 1
          return acc + (gap * strengthMult * layerMult)
        }
        return acc
      }, 0)
      score += Math.min(30, valueBoost / 10)
    }

    // Emotional weight (10% weight) — heavy items get a boost to force deliberate scheduling
    if (activity?.emotional_weight === 'heavy') score += 10
    else if (activity?.emotional_weight === 'light') score -= 5

    // Source (10% weight) — outside requests score higher
    if (item.source === 'outside_request') score += 10
    else if (item.source === 'template_proposal') score -= 5

    // Tier assignment
    const hasCriticalValueGap = (activity?.value_links ?? []).some(vl => {
      const v = vl.value
      if (!v) return false
      const layer = v.layer
      if (layer !== 'safety' && layer !== 'security') return false
      return v.sufficiency_mark > 0 && (v.score / v.sufficiency_mark) < 0.7
    })

    let tier: 'urgent' | 'normal' | 'suggested' = 'normal'
    if (
      (item.proposed_date && item.proposed_date < today) ||
      (item.proposed_date && item.proposed_date <= threeDaysOut) ||
      score >= 40 ||
      hasCriticalValueGap
    ) {
      tier = 'urgent'
    } else if (
      item.source === 'template_proposal' &&
      score < 10 &&
      (!item.proposed_date || item.proposed_date > weekOut)
    ) {
      tier = 'suggested'
    }

    return {
      id: item.id,
      priority_score: Math.round(score * 10) / 10,
      priority_tier: tier,
    }
  })

  // Batch update all items
  await Promise.all(
    updates.map(({ id, priority_score, priority_tier }) =>
      supabase
        .from('action_items')
        .update({ priority_score, priority_tier })
        .eq('id', id)
        .eq('user_id', user.id)
    )
  )

  return NextResponse.json({ updated: updates.length })
}
