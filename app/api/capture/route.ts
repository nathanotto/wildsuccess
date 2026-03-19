import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parseCapture, UserContext } from '@/lib/capture-parser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawInput, source = 'today' } = await req.json()
  if (!rawInput?.trim()) return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()

  // Load user context in parallel
  const [peopleRes, activitiesRes, suggestionsRes, profileRes] = await Promise.all([
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
    values: [],
    userName: profileRes.data?.preferred_name ?? profileRes.data?.full_name ?? '',
  }

  const parsed = parseCapture(rawInput.trim(), ctx, now)

  let hopperItem = null
  let scheduleItem = null
  let logEntry = null

  // For /today source: plain captures also get a schedule_item for today
  const isToday = source === 'today'

  if (parsed.outcome === 'logged') {
    const { data } = await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'logged',
      event_date: today,
      note: rawInput.trim(),
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

  } else if (parsed.outcome === 'captured' || parsed.outcome === 'captured_dated') {
    const proposedDate = parsed.date ?? (isToday ? today : null)
    const { data: hi } = await supabase.from('hopper_items').insert({
      user_id: user.id,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: isToday ? 'activated' : 'pending',
      priority_score: 0,
      priority_tier: 'normal',
      bounding_type: 'action',
      time_type: parsed.timeType ?? 'B',
      enrichment_status: 'none',
      proposed_date: proposedDate,
      resolved_at: isToday ? now.toISOString() : null,
    }).select().single()
    hopperItem = hi

    // For /today: also create a schedule_item so it appears on today's list
    if (isToday && hi && (!parsed.date || parsed.date === today)) {
      const { data: si } = await supabase.from('schedule_items').insert({
        user_id: user.id,
        hopper_item_id: hi.id,
        name: parsed.cleanedName,
        scheduled_date: today,
        scheduled_time: null,
        flexibility: 'anytime_today',
        context: [],
        time_type: parsed.timeType ?? 'B',
        emotional_weight: 'normal',
        bounding_type: 'action',
        status: 'active',
        sort_order: 9999,
      }).select('*, item_notes(*)').single()
      scheduleItem = si

      await supabase.from('action_log').insert({
        user_id: user.id,
        event_type: 'captured',
        hopper_item_id: hi.id,
        schedule_item_id: si?.id ?? null,
        event_date: today,
        note: rawInput.trim(),
      })
    }

  } else if (parsed.outcome === 'scheduled_soft' || parsed.outcome === 'scheduled_hard') {
    const { data: si } = await supabase.from('schedule_items').insert({
      user_id: user.id,
      name: parsed.cleanedName,
      scheduled_date: parsed.date ?? today,
      scheduled_time: parsed.time ?? null,
      scheduled_end_time: parsed.endTime ?? null,
      flexibility: parsed.outcome === 'scheduled_hard' ? 'hard_scheduled' : 'soft_scheduled',
      context: [],
      time_type: parsed.timeType ?? 'B',
      emotional_weight: 'normal',
      bounding_type: 'action',
      status: 'active',
      sort_order: 0,
    }).select('*, item_notes(*)').single()
    scheduleItem = si

    await supabase.from('action_log').insert({
      user_id: user.id,
      event_type: 'scheduled',
      schedule_item_id: si?.id ?? null,
      event_date: today,
      note: rawInput.trim(),
    })

  } else if (parsed.outcome === 'tickler') {
    const { data: hi } = await supabase.from('hopper_items').insert({
      user_id: user.id,
      raw_input: rawInput.trim(),
      source: 'quick_capture',
      status: 'pending',
      priority_score: 0,
      priority_tier: 'normal',
      bounding_type: 'action',
      time_type: parsed.timeType ?? 'B',
      enrichment_status: 'none',
      proposed_date: parsed.date,
      metadata: { isTickler: true },
    }).select().single()
    hopperItem = hi

  } else if (parsed.outcome === 'outside_request' || parsed.outcome === 'commitment') {
    const { data: hi } = await supabase.from('hopper_items').insert({
      user_id: user.id,
      raw_input: rawInput.trim(),
      source: 'outside_request',
      status: isToday ? 'activated' : 'pending',
      priority_score: 0,
      priority_tier: 'normal',
      bounding_type: 'action',
      time_type: parsed.timeType ?? 'B',
      enrichment_status: 'none',
      proposed_date: parsed.date ?? null,
      resolved_at: isToday ? now.toISOString() : null,
      metadata: parsed.outcome === 'commitment'
        ? { isCommitment: true, committedTo: parsed.person?.name, person_id: parsed.person?.id }
        : { requestedBy: parsed.person?.name, person_id: parsed.person?.id },
    }).select().single()
    hopperItem = hi

    if (isToday && hi) {
      const { data: si } = await supabase.from('schedule_items').insert({
        user_id: user.id,
        hopper_item_id: hi.id,
        name: parsed.cleanedName,
        scheduled_date: today,
        scheduled_time: parsed.time ?? null,
        flexibility: 'anytime_today',
        context: [],
        time_type: parsed.timeType ?? 'B',
        emotional_weight: 'normal',
        bounding_type: 'action',
        status: 'active',
        sort_order: 9999,
      }).select('*, item_notes(*)').single()
      scheduleItem = si
    }
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

  return NextResponse.json({ parsed, hopperItem, scheduleItem, logEntry }, { status: 201 })
}
