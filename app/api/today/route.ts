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

  // Fetch action_items, time_blocks, logged entries, and hopper data in parallel
  const [itemsRes, blocksRes, loggedRes, ...hopperResults] = await Promise.all([
    supabase
      .from('action_items')
      .select('*, item_notes(*)')
      .eq('user_id', user.id)
      .eq('committed_date', date)
      .not('status', 'in', '("rescheduled","dismissed","archived")')
      .or(`status.neq.parked,parked_until.lte.${date}`)
      .order('sort_order', { ascending: true }),
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
  let items = itemsRes.data ?? []

  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]))

  // Build a lookup of which block_ids already have a linked action_item
  const linkedBlockIds = new Set(items.map(i => i.time_block_id).filter(Boolean))

  // Orphaned blocks: no linked action_item, not a calendar import, has a label
  const orphanedBlocks = blocks.filter(b =>
    !linkedBlockIds.has(b.id) &&
    b.source !== 'calendar_import' &&
    b.label?.trim()
  )

  if (orphanedBlocks.length > 0) {
    // For each orphaned block, try to match an existing timeless action_item by name.
    // If matched, link it. Otherwise, create a new action_item.
    const timelessItems = items.filter(i => !i.time_block_id && !i.scheduled_time)

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

  return NextResponse.json({ items, nextUp, loggedItems, hopperItems, suggestedData })
}
