import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are the enrichment engine for Wild Success, a personal productivity app.
The user has just captured a quick note. Your job is to analyze it and return structured enrichment data.

You have access to the user's complete Wild Success context:
- Their values (preventive and promotional), with current scores
- Their life domains
- Their existing Activity templates (recurring practices)
- Their Big Outcomes (active goals)
- Their block types (categories of time)
- Their recent captures (for pattern context)

Your task:
1. Determine if this capture matches an existing Activity template.
   - If yes: return match_type "existing_template" with the matched activity's id and name.
   - If no: return match_type "new_template" with suggested attributes for a new template.

2. For ALL captures, suggest:
   - A clean name (fix typos, clarify abbreviations)
   - Life domain (use only IDs from the provided list)
   - Value links (which values this serves, with contribution_strength: weak/moderate/strong)
   - Big Outcome link (if this clearly serves an active goal)
   - Energy level (A = needs best attention/external-facing, B = routine/batchable, C = easy/recovery)
   - Emotional weight (light / normal / heavy — heavy = disproportionate felt burden relative to time)
   - Context tags (e.g. 'errand-out', 'computer-home', 'phone-anywhere', 'focused-quiet')
   - Block type (which type of time block this fits in — use only IDs from the provided list)
   - Recurrence (one_time, daily, weekly, biweekly, monthly, quarterly, annual — null if unclear)
   - Preferred days (array of 'Mon','Tue','Wed','Thu','Fri','Sat','Sun' or null)
   - Preferred time of day (morning / afternoon / evening / null)
   - Duration range in minutes (min and max)
   - Flexibility (hard_scheduled, soft_scheduled, anytime_today, anytime_this_week)
   - Whether it's preventive (neglecting it causes harm) or promotional (pursuing growth)

3. Include a confidence score (0-1) and a brief reasoning string.

IMPORTANT: Use ONLY the IDs and names from the user's actual data. Do not invent values,
domains, activities, or outcomes. If nothing matches, leave the field null.

Return ONLY a valid JSON object with this exact structure — no preamble, no markdown:
{
  "match_type": "existing_template" | "new_template",
  "matched_activity_id": string | null,
  "matched_activity_name": string | null,
  "suggested_name": string,
  "suggested_description": string | null,
  "suggested_life_domain_id": string | null,
  "suggested_life_domain_name": string | null,
  "suggested_value_links": [{"value_id": string, "value_name": string, "contribution_strength": "weak"|"moderate"|"strong"}],
  "suggested_big_outcome_id": string | null,
  "suggested_big_outcome_name": string | null,
  "suggested_energy_level": "A" | "B" | "C",
  "suggested_emotional_weight": "light" | "normal" | "heavy",
  "suggested_context": string[],
  "suggested_block_type_id": string | null,
  "suggested_block_type_name": string | null,
  "suggested_recurrence": string | null,
  "suggested_preferred_days": string[] | null,
  "suggested_preferred_time": string | null,
  "suggested_duration_min": number | null,
  "suggested_duration_max": number | null,
  "suggested_flexibility": "hard_scheduled" | "soft_scheduled" | "anytime_today" | "anytime_this_week",
  "suggested_is_preventive": boolean,
  "confidence": number,
  "reasoning": string
}`

function buildUserMessage(rawInput: string, ctx: {
  values: unknown[], domains: unknown[], activities: unknown[],
  outcomes: unknown[], blockTypes: unknown[], recentHopper: unknown[]
}): string {
  return `Capture text: "${rawInput}"

User context:
Values: ${JSON.stringify((ctx.values as Record<string, unknown>[]).map(v => ({ id: v.id, name: v.name, type: v.value_type, score: v.score, sufficiency_status: v.sufficiency_status })))}
Life domains: ${JSON.stringify((ctx.domains as Record<string, unknown>[]).map(d => ({ id: d.id, name: d.name })))}
Activity templates: ${JSON.stringify((ctx.activities as Record<string, unknown>[]).map(a => ({ id: a.id, name: a.name, recurrence: a.frequency, energy_level: a.energy_level, value_links: a.activity_value_links, domain_links: a.activity_domain_links })))}
Big Outcomes: ${JSON.stringify((ctx.outcomes as Record<string, unknown>[]).map(o => ({ id: o.id, name: o.name, status: o.status })))}
Block types: ${JSON.stringify((ctx.blockTypes as Record<string, unknown>[]).map(bt => ({ id: bt.id, name: bt.name, energy_level: bt.energy_level })))}
Recent captures: ${JSON.stringify((ctx.recentHopper as Record<string, unknown>[]).map(h => ({ raw_input: h.raw_input, enriched_name: (h.enrichment_data as Record<string, unknown> | null)?.suggested_name ?? null })))}`
}

function validateIds(enrichment: Record<string, unknown>, ctx: {
  values: Record<string, unknown>[], domains: Record<string, unknown>[],
  activities: Record<string, unknown>[], outcomes: Record<string, unknown>[],
  blockTypes: Record<string, unknown>[]
}): Record<string, unknown> {
  if (enrichment.matched_activity_id) {
    if (!ctx.activities.some(a => a.id === enrichment.matched_activity_id)) {
      enrichment.match_type = 'new_template'
      enrichment.matched_activity_id = null
      enrichment.matched_activity_name = null
    }
  }
  if (enrichment.suggested_value_links) {
    enrichment.suggested_value_links = (enrichment.suggested_value_links as Record<string, unknown>[])
      .filter(vl => ctx.values.some(v => v.id === vl.value_id))
  }
  if (enrichment.suggested_life_domain_id) {
    if (!ctx.domains.some(d => d.id === enrichment.suggested_life_domain_id)) {
      enrichment.suggested_life_domain_id = null
      enrichment.suggested_life_domain_name = null
    }
  }
  if (enrichment.suggested_big_outcome_id) {
    if (!ctx.outcomes.some(o => o.id === enrichment.suggested_big_outcome_id)) {
      enrichment.suggested_big_outcome_id = null
      enrichment.suggested_big_outcome_name = null
    }
  }
  if (enrichment.suggested_block_type_id) {
    if (!ctx.blockTypes.some(bt => bt.id === enrichment.suggested_block_type_id)) {
      enrichment.suggested_block_type_id = null
      enrichment.suggested_block_type_name = null
    }
  }
  return enrichment
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { hopper_item_id } = await req.json()
  if (!hopper_item_id) return NextResponse.json({ error: 'hopper_item_id required' }, { status: 400 })

  // Fetch the hopper item
  const { data: hopperItem } = await supabase
    .from('hopper_items')
    .select('raw_input')
    .eq('id', hopper_item_id)
    .eq('user_id', user.id)
    .single()
  if (!hopperItem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark as pending
  await supabase.from('hopper_items')
    .update({ enrichment_status: 'pending' })
    .eq('id', hopper_item_id)

  try {
    // Build context in parallel
    const [valuesRes, domainsRes, activitiesRes, outcomesRes, blockTypesRes, recentRes] = await Promise.all([
      supabase.from('user_values').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('life_domains').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('activities')
        .select('id, name, frequency, energy_level, activity_value_links(value_id, contribution_strength), activity_domain_links(domain_id)')
        .eq('user_id', user.id).eq('status', 'active').is('archived_at', null),
      supabase.from('big_outcomes').select('id, name, status').eq('user_id', user.id).in('status', ['aspirational', 'in_progress']),
      supabase.from('block_types').select('id, name, energy_level').eq('user_id', user.id).eq('is_active', true),
      supabase.from('hopper_items').select('raw_input, enrichment_data')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    ])

    const ctx = {
      values: (valuesRes.data ?? []) as Record<string, unknown>[],
      domains: (domainsRes.data ?? []) as Record<string, unknown>[],
      activities: (activitiesRes.data ?? []) as Record<string, unknown>[],
      outcomes: (outcomesRes.data ?? []) as Record<string, unknown>[],
      blockTypes: (blockTypesRes.data ?? []) as Record<string, unknown>[],
      recentHopper: (recentRes.data ?? []) as Record<string, unknown>[],
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(hopperItem.raw_input, ctx) }],
    })

    const text = (message.content[0] as { type: string; text: string }).text
      .replace(/```json\n?|\n?```/g, '').trim()
    let enrichment = JSON.parse(text) as Record<string, unknown>
    enrichment = validateIds(enrichment, ctx)

    await supabase.from('hopper_items').update({
      enrichment_status: 'enriched',
      enrichment_data: enrichment,
      enriched_at: new Date().toISOString(),
      block_type_hint: enrichment.suggested_block_type_id ?? null,
    }).eq('id', hopper_item_id)

    return NextResponse.json(enrichment)
  } catch (err) {
    console.error('Enrichment failed:', err)
    await supabase.from('hopper_items')
      .update({ enrichment_status: 'none' })
      .eq('id', hopper_item_id)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
