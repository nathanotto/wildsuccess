import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date') ?? new Date().toISOString().split('T')[0]
  const todayDate = new Date().toISOString().split('T')[0]
  const showHopper = date >= todayDate // only for today + future

  // Compute end-of-week (Sunday) for hopper query
  const reqDate = new Date(date + 'T12:00:00')
  const dayOfWeek = reqDate.getDay() // 0=Sun
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const weekEnd = new Date(reqDate); weekEnd.setDate(weekEnd.getDate() + daysToSunday)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Compute start-of-week (Monday) for dismissed_week matching
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(reqDate); weekStart.setDate(weekStart.getDate() - daysToMonday)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // View mode determines query shape for rolling to-dos
  // mode=pinned: original pinned-date behavior (for day completion page — only items committed on this exact date)
  const mode = sp.get('mode')
  const isPinned = mode === 'pinned'
  const isPast = date < todayDate
  const isFuture = date > todayDate

  // Build items query based on view mode:
  // - Pinned: exact date match (for day completion — shows only that day's items)
  // - Today: rolling active items (committed_date <= today) + completed today
  // - Past: historical snapshot (committed on/before that day, not yet resolved by that day)
  // - Future: only explicitly planned items
  const itemsQuery = isPinned || isFuture
    ? supabase
        .from('action_items')
        .select('*, item_notes(*)')
        .eq('user_id', user.id)
        .eq('committed_date', date)
        .not('status', 'in', '("rescheduled","dismissed","archived")')
        .order('sort_order', { ascending: true })
    : isPast
      ? supabase
          .from('action_items')
          .select('*, item_notes(*)')
          .eq('user_id', user.id)
          .lte('committed_date', date)
          .not('status', 'in', '("rescheduled","dismissed","archived")')
          .or(`completed_date.is.null,completed_date.gte.${date}`)
          .or(`committed_date.eq.${date},scheduled_time.is.null`)
          .or(`status.neq.parked,parked_until.lte.${date}`)
          .order('sort_order', { ascending: true })
      : // Today: rolling active items
        // Only unscheduled items roll forward from past dates.
        // Scheduled items stay pinned to their date (handled by "yesterday's unfinished" triage).
        supabase
          .from('action_items')
          .select('*, item_notes(*)')
          .eq('user_id', user.id)
          .lte('committed_date', todayDate)
          .not('status', 'in', '("completed","skipped","rescheduled","dismissed","archived")')
          .or(`committed_date.eq.${todayDate},scheduled_time.is.null`)
          .or(`status.neq.parked,parked_until.lte.${todayDate}`)
          .order('sort_order', { ascending: true })

  // For today view, also fetch items completed today (separate query)
  const completedTodayQuery = !isPast && !isFuture
    ? supabase
        .from('action_items')
        .select('*, item_notes(*)')
        .eq('user_id', user.id)
        .eq('completed_date', todayDate)
        .eq('committed_date', todayDate)
        .eq('status', 'completed')
        .order('sort_order', { ascending: true })
    : null

  // For today view: fetch yesterday's incomplete scheduled items for the triage box
  const yesterdayStr = new Date(new Date(todayDate + 'T12:00:00').getTime() - 86400000).toISOString().split('T')[0]
  const yesterdayUnfinishedQuery = !isPast && !isFuture
    ? supabase
        .from('action_items')
        .select('*, item_notes(*)')
        .eq('user_id', user.id)
        .eq('committed_date', yesterdayStr)
        .not('scheduled_time', 'is', null)
        .not('status', 'in', '("completed","skipped","rescheduled","dismissed","archived")')
        .order('scheduled_time', { ascending: true })
    : null

  // Fetch action_items, time_blocks, logged entries, and hopper data in parallel
  const [itemsRes, blocksRes, loggedRes, completedTodayRes, yesterdayUnfinishedRes, ...hopperResults] = await Promise.all([
    itemsQuery,
    supabase
      .from('time_blocks')
      .select('id, label, start_time, end_time, source, time_type')
      .eq('user_id', user.id)
      .eq('block_date', date),
    supabase
      .from('action_log')
      .select('id, note, metadata, created_at')
      .eq('user_id', user.id)
      .eq('event_type', 'logged')
      .eq('event_date', date)
      .order('created_at', { ascending: true }),
    // Completed-today items (only for today view, null placeholder otherwise)
    completedTodayQuery ?? Promise.resolve({ data: null, error: null }),
    yesterdayUnfinishedQuery ?? Promise.resolve({ data: null, error: null }),
    // Hopper: candidate items for this week (non-template)
    ...(showHopper ? [
      supabase
        .from('action_items')
        .select('*, activity:activities(time_type, emotional_weight, duration_range_min, duration_range_max, preferred_time, frequency)')
        .eq('user_id', user.id)
        .eq('status', 'candidate')
        .neq('source', 'template_proposal')
        .or(`proposed_date.is.null,proposed_date.lte.${weekEndStr}`)
        .order('priority_score', { ascending: false })
        .limit(20),
      // Activities for suggested computation
      supabase
        .from('activities')
        .select('id, name, time_type, emotional_weight, frequency, duration_range_min, duration_range_max, preferred_time, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true),
      // Coverage: committed/completed items by activity_id
      supabase
        .from('action_items')
        .select('activity_id, committed_date')
        .eq('user_id', user.id)
        .in('status', ['committed', 'in_progress', 'completed'])
        .not('activity_id', 'is', null)
        .not('committed_date', 'is', null),
      // Dismissed virtual items this week
      supabase
        .from('action_items')
        .select('id, activity_id, name, metadata')
        .eq('user_id', user.id)
        .eq('status', 'dismissed')
        .eq('source', 'template_proposal'),
    ] : []),
  ])

  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 })

  const blocks = blocksRes.data ?? []

  // Merge rolling active items + completed-today items (deduplicate by id)
  let items = itemsRes.data ?? []
  const completedToday = (completedTodayRes as { data: typeof items | null })?.data ?? []
  if (completedToday.length > 0) {
    const existingIds = new Set(items.map(i => i.id))
    items = [...items, ...completedToday.filter(i => !existingIds.has(i.id))]
  }

  // Yesterday's incomplete scheduled items — fetched separately for triage box
  const yesterdayUnfinished = (yesterdayUnfinishedRes as { data: typeof items | null })?.data ?? []

  // Remove any yesterday items that somehow ended up in the main items list
  if (!isPast && !isFuture) {
    const yesterdayIds = new Set(yesterdayUnfinished.map(i => i.id))
    items = items.filter(i => !yesterdayIds.has(i.id))
  }

  // Auto-transition expired parked items back to committed (today view only)
  if (!isPast && !isFuture) {
    const expiredParked = items.filter(i => i.status === 'parked' && i.parked_until && i.parked_until <= todayDate)
    if (expiredParked.length > 0) {
      const expiredIds = expiredParked.map(i => i.id)
      await supabase
        .from('action_items')
        .update({ status: 'committed' })
        .in('id', expiredIds)
        .eq('user_id', user.id)
      items = items.map(i => expiredIds.includes(i.id) ? { ...i, status: 'committed' } : i)
    }
  }

  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]))

  // Build a lookup of which block_ids already have a linked action_item
  // Only consider items committed for this specific date (not rolled-forward items)
  const dateScopedItems = items.filter(i => i.committed_date === date)
  const linkedBlockIds = new Set(dateScopedItems.map(i => i.time_block_id).filter(Boolean))

  // Also check for action_items linked to blocks that might not be in the rolling query results
  const { data: allLinkedItems } = await supabase
    .from('action_items')
    .select('time_block_id')
    .eq('user_id', user.id)
    .eq('committed_date', date)
    .not('time_block_id', 'is', null)
    .not('status', 'in', '("archived")')
  const allLinkedBlockIds = new Set([
    ...linkedBlockIds,
    ...((allLinkedItems ?? []).map(i => i.time_block_id).filter(Boolean)),
  ])

  // Orphaned blocks: no linked action_item, not a calendar import, has a label
  const orphanedBlocks = blocks.filter(b =>
    !allLinkedBlockIds.has(b.id) &&
    b.source !== 'calendar_import' &&
    b.label?.trim()
  )

  if (orphanedBlocks.length > 0) {
    // For each orphaned block, try to match an existing timeless action_item by name.
    // If matched, link it. Otherwise, create a new action_item.
    const timelessItems = dateScopedItems.filter(i => !i.time_block_id && !i.scheduled_time)

    const toCreate: typeof orphanedBlocks = []

    for (const block of orphanedBlocks) {
      const match = timelessItems.find(
        i => i.name.trim().toLowerCase() === block.label.trim().toLowerCase()
      )

      if (match) {
        // Link the existing item to this block
        await supabase
          .from('action_items')
          .update({
            time_block_id: block.id,
            scheduled_time: block.start_time ?? null,
            scheduled_end_time: block.end_time ?? null,
          })
          .eq('id', match.id)
          .eq('user_id', user.id)

        // Update in our local array
        items = items.map(i => i.id === match.id
          ? { ...i, time_block_id: block.id, scheduled_time: block.start_time ?? null, scheduled_end_time: block.end_time ?? null }
          : i
        )
      } else {
        toCreate.push(block)
      }
    }

    if (toCreate.length > 0) {
      const { data: created } = await supabase
        .from('action_items')
        .insert(toCreate.map(b => ({
          user_id: user.id,
          name: b.label.trim(),
          status: 'committed' as const,
          committed_date: date,
          scheduled_time: b.start_time ?? null,
          scheduled_end_time: b.end_time ?? null,
          time_block_id: b.id,
          time_type: (b.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
          bounding_type: 'action' as const,
          emotional_weight: 'normal' as const,
          sort_order: 0,
          enrichment_status: 'none' as const,
        })))
        .select('*, item_notes(*)')

      if (created) items = [...items, ...created]
    }
  }

  // Sync scheduled_time from time_block — the block is the source of truth for time
  // This handles both items with no scheduled_time AND items where the block was moved in /organize
  items = items.map(item => {
    if (item.time_block_id && blockMap[item.time_block_id]?.start_time) {
      return {
        ...item,
        scheduled_time: blockMap[item.time_block_id].start_time,
        scheduled_end_time: blockMap[item.time_block_id].end_time ?? item.scheduled_end_time ?? null,
      }
    }
    return item
  })

  // Determine "next up": next upcoming time-locked item (today only)
  const now = new Date()
  let nextUp = null

  if (date === todayDate) {
    const currentTime = now.toTimeString().slice(0, 5)
    const upcoming = items
      .filter(i => i.scheduled_time && i.status !== 'completed' && i.status !== 'skipped')
      .sort((a, b) => (a.scheduled_time as string).localeCompare(b.scheduled_time as string))
    nextUp = upcoming.find(i => (i.scheduled_time as string).slice(0, 5) > currentTime) ?? null
  }

  const loggedItems = loggedRes.data ?? []

  // Build hopper + suggested data if applicable
  let hopperItems: unknown[] = []
  let suggestedData: { activities: unknown[]; coverage: unknown[]; dismissedActivityIds: string[]; weekStart: string } | null = null

  if (showHopper && hopperResults.length === 4) {
    const [hopperRes, activitiesRes, coverageRes, dismissedRes] = hopperResults
    hopperItems = (hopperRes as { data: unknown[] | null }).data ?? []
    const activities = (activitiesRes as { data: unknown[] | null }).data ?? []
    const coverage = (coverageRes as { data: unknown[] | null }).data ?? []
    const dismissed = (dismissedRes as { data: Array<{ activity_id: string | null; metadata?: Record<string, unknown> | null }> | null }).data ?? []

    // Filter dismissed to this week only (check metadata.dismissed_week)
    const dismissedActivityIds = dismissed
      .filter(d => d.activity_id && d.metadata?.dismissed_week === weekStartStr)
      .map(d => d.activity_id!)

    suggestedData = { activities, coverage, dismissedActivityIds, weekStart: weekStartStr }
  }

  return NextResponse.json({ items, nextUp, loggedItems, hopperItems, suggestedData, yesterdayUnfinished })
}
