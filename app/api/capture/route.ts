import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parseCapture, UserContext } from '@/lib/capture-parser'
import { getUserToday } from '@/lib/timezone'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawInput, source = 'today' } = await req.json()
  if (!rawInput?.trim()) return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })

  const today = await getUserToday(supabase, user.id)
  const now = new Date()

  // Load user context in parallel
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
      id: p.id,
      name: p.name,
      normalizedName: p.normalized_name,
      mentionCount: p.mention_count,
      valueLinks: (p.known_people_value_links ?? []).map((vl: any) => ({
        valueId: vl.value_id,
        valueName: vl.user_values?.name ?? '',
        strength: vl.contribution_strength,
      })),
    })),
    activities: (activitiesRes.data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      normalizedName: a.name.toLowerCase().trim(),
      timeType: a.time_type,
      valueLinks: (a.activity_value_links ?? []).map((vl: any) => ({
        valueId: vl.value_id,
        valueName: vl.user_values?.name ?? '',
        strength: vl.contribution_strength,
      })),
    })),
    taskSuggestions: (suggestionsRes.data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      normalizedName: t.name.toLowerCase().trim(),
    })),
    values: (valuesRes.data ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      normalizedName: v.name.toLowerCase().trim(),
    })),
    userName: profileRes.data?.preferred_name ?? profileRes.data?.full_name ?? '',
  }

  const parsed = parseCapture(rawInput.trim(), ctx, now)

  let actionItem = null
  let logEntry = null

  const isToday = source === 'today'

  // Extract value IDs from parser's resolved valueLinks (from matched people + activities)
  const valueIds = parsed.valueLinks.length > 0
    ? parsed.valueLinks.map(vl => vl.valueId)
    : null

  if (parsed.outcome === 'logged') {
    const { data } = await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'logged',
      event_date: today,
      note: rawInput.trim(),
      value_ids: valueIds,
      metadata: {
        cleanedName: parsed.cleanedName,
        duration: parsed.duration,
        person: parsed.person,
        feelings: parsed.feelings,
        valueLinks: parsed.valueLinks,
        timeType: parsed.timeType,
      },
    }).select().single()
    logEntry = data

  } else if (parsed.outcome === 'captured') {
    const isCommitted = isToday
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: isCommitted ? 'committed' : 'candidate',
      committed_date: isCommitted ? today : null,
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: isCommitted ? 9999 : 0,
      enrichment_status: 'none',
      activity_id: parsed.activityMatch?.id ?? null,
      task_suggestion_id: null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'captured',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: valueIds,
    })

  } else if (parsed.outcome === 'captured_dated') {
    const isCommitted = isToday && parsed.date === today
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: isCommitted ? 'committed' : 'candidate',
      proposed_date: isCommitted ? null : (parsed.date ?? null),
      committed_date: isCommitted ? today : null,
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: isCommitted ? 9999 : 0,
      enrichment_status: 'none',
      activity_id: parsed.activityMatch?.id ?? null,
      task_suggestion_id: null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'captured',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: valueIds,
    })

  } else if (parsed.outcome === 'scheduled_soft' || parsed.outcome === 'scheduled_hard') {
    const isHard = parsed.outcome === 'scheduled_hard'
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'committed',
      committed_date: parsed.date ?? today,
      scheduled_time: parsed.time ?? null,
      scheduled_end_time: parsed.endTime ?? null,
      flexibility: isHard ? 'hard_scheduled' : 'soft_scheduled',
      item_type: isHard ? 'appointment' : 'task',
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: 0,
      enrichment_status: 'none',
      activity_id: parsed.activityMatch?.id ?? null,
      task_suggestion_id: null,
    }).select('*, item_notes(*)').single()
    actionItem = data

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'scheduled',
      action_item_id: data?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
      value_ids: valueIds,
    })

  } else if (parsed.outcome === 'tickler') {
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'candidate',
      item_type: 'tickler',
      proposed_date: parsed.date ?? null,
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      enrichment_status: 'none',
    }).select('*, item_notes(*)').single()
    actionItem = data

  } else if (parsed.outcome === 'outside_request') {
    const isCommitted = isToday
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'outside_request',
      status: isCommitted ? 'committed' : 'candidate',
      item_type: 'outside_request',
      committed_date: isCommitted ? today : null,
      proposed_date: isCommitted ? null : (parsed.date ?? null),
      person_id: parsed.person?.id ?? null,
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      sort_order: isCommitted ? 9999 : 0,
      enrichment_status: 'none',
    }).select('*, item_notes(*)').single()
    actionItem = data

  } else if (parsed.outcome === 'commitment') {
    const { data } = await supabase.from('action_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'committed',
      item_type: 'commitment',
      committed_date: today,
      committed_to_person_id: parsed.person?.id ?? null,
      time_type: parsed.timeType ?? 'B',
      bounding_type: 'action',
      emotional_weight: 'normal',
      enrichment_status: 'none',
    }).select('*, item_notes(*)').single()
    actionItem = data
  }

  // Increment mention count for matched person
  if (parsed.person) {
    const { data: personRow } = await supabase
      .from('known_people')
      .select('mention_count')
      .eq('id', parsed.person.id)
      .single()
    if (personRow) {
      await supabase.from('known_people').update({
        mention_count: (personRow.mention_count ?? 0) + 1,
        last_mentioned_at: now.toISOString(),
      }).eq('id', parsed.person.id)
    }
  }

  return NextResponse.json({ parsed, actionItem, logEntry }, { status: 201 })
}
