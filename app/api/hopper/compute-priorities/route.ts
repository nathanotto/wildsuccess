import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — compute priority_score, priority_tier, and block_type_hint for all pending hopper items
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // Fetch pending hopper items with their activity context
  const { data: items, error } = await supabase
    .from('hopper_items')
    .select(`
      id,
      source,
      proposed_date,
      metadata,
      activity:activities(
        id,
        emotional_weight,
        energy_level,
        flexibility,
        value_links:activity_value_links(
          value_id,
          contribution_strength,
          value:values(score, sufficiency_mark)
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ updated: 0 })

  // Fetch block types for hint assignment
  const { data: blockTypes } = await supabase
    .from('block_types')
    .select('id, name, energy_level')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const focusBlockId = blockTypes?.find(bt => bt.name === 'Focus')?.id ?? null
  const communicateBlockId = blockTypes?.find(bt => bt.name === 'Communicate')?.id ?? null
  const outingBlockId = blockTypes?.find(bt => bt.name === 'Outing')?.id ?? null
  const adminBlockId = blockTypes?.find(bt => bt.name === 'Admin')?.id ?? null

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
      energy_level?: string
      flexibility?: string
      value_links?: Array<{
        contribution_strength: string
        value?: { score: number; sufficiency_mark: number }
      }>
    } | null

    if (activity?.value_links?.length) {
      const valueBoost = activity.value_links.reduce((acc, vl) => {
        const v = vl.value
        if (!v) return acc
        const gap = v.sufficiency_mark - v.score
        if (gap > 0) {
          const multiplier = vl.contribution_strength === 'strong' ? 3 : vl.contribution_strength === 'moderate' ? 2 : 1
          return acc + (gap * multiplier)
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
    let tier: 'urgent' | 'normal' | 'suggested' = 'normal'
    if (
      (item.proposed_date && item.proposed_date < today) ||
      (item.proposed_date && item.proposed_date <= threeDaysOut) ||
      score >= 40
    ) {
      tier = 'urgent'
    } else if (
      item.source === 'template_proposal' &&
      score < 10 &&
      (!item.proposed_date || item.proposed_date > weekOut)
    ) {
      tier = 'suggested'
    }

    // Block type hint based on energy level and context
    let blockTypeHint: string | null = null
    if (activity?.energy_level === 'A') blockTypeHint = focusBlockId
    else if (activity?.energy_level === 'C') blockTypeHint = outingBlockId
    else if (item.source === 'outside_request') blockTypeHint = communicateBlockId
    else blockTypeHint = adminBlockId

    return {
      id: item.id,
      priority_score: Math.round(score * 10) / 10,
      priority_tier: tier,
      block_type_hint: blockTypeHint,
    }
  })

  // Batch update all items
  await Promise.all(
    updates.map(({ id, priority_score, priority_tier, block_type_hint }) =>
      supabase
        .from('hopper_items')
        .update({ priority_score, priority_tier, block_type_hint })
        .eq('id', id)
        .eq('user_id', user.id)
    )
  )

  return NextResponse.json({ updated: updates.length })
}
