import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const date = sp.get('date') ?? new Date().toISOString().split('T')[0]

  // Fetch schedule_items and time_blocks in parallel
  const [itemsRes, blocksRes] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('*, item_notes(*)')
      .eq('user_id', user.id)
      .eq('scheduled_date', date)
      .not('status', 'eq', 'rescheduled')
      .or(`status.neq.parked,parked_until.lte.${date}`)
      .order('sort_order', { ascending: true }),
    supabase
      .from('time_blocks')
      .select('id, label, start_time, end_time, source, time_type')
      .eq('user_id', user.id)
      .eq('block_date', date),
  ])

  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 })

  const blocks = blocksRes.data ?? []
  let items = itemsRes.data ?? []

  const blockMap = Object.fromEntries(blocks.map(b => [b.id, b]))

  // Build a lookup of which block_ids already have a schedule_item
  const linkedBlockIds = new Set(items.map(i => i.time_block_id).filter(Boolean))

  // Orphaned blocks: no linked schedule_item, not a calendar import, has a label
  const orphanedBlocks = blocks.filter(b =>
    !linkedBlockIds.has(b.id) &&
    b.source !== 'calendar_import' &&
    b.label?.trim()
  )

  if (orphanedBlocks.length > 0) {
    // For each orphaned block, check if an existing timeless schedule_item matches by name.
    // If so, link it to the block (update time_block_id + scheduled_time) rather than creating a duplicate.
    // Otherwise, create a new schedule_item.
    const timelessItems = items.filter(i => !i.time_block_id && !i.scheduled_time)

    const toCreate: typeof orphanedBlocks = []

    for (const block of orphanedBlocks) {
      const match = timelessItems.find(
        i => i.name.trim().toLowerCase() === block.label.trim().toLowerCase()
      )

      if (match) {
        // Link the existing item to this block
        await supabase
          .from('schedule_items')
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
        .from('schedule_items')
        .insert(toCreate.map(b => ({
          user_id: user.id,
          name: b.label.trim(),
          scheduled_date: date,
          scheduled_time: b.start_time ?? null,
          scheduled_end_time: b.end_time ?? null,
          time_block_id: b.id,
          flexibility: 'anytime_today' as const,
          context: [] as string[],
          time_type: (b.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
          emotional_weight: 'normal' as const,
          bounding_type: 'action' as const,
          status: 'active' as const,
          sort_order: 0,
        })))
        .select('*, item_notes(*)')

      if (created) items = [...items, ...created]
    }
  }

  // For items that still have a time_block_id but no scheduled_time, fill in from the block
  items = items.map(item => {
    if (!item.scheduled_time && item.time_block_id && blockMap[item.time_block_id]?.start_time) {
      return {
        ...item,
        scheduled_time: blockMap[item.time_block_id].start_time,
        scheduled_end_time: item.scheduled_end_time ?? blockMap[item.time_block_id].end_time ?? null,
      }
    }
    return item
  })

  // Determine "next up": next upcoming time-locked item (today only)
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  let nextUp = null

  if (date === todayStr) {
    const currentTime = now.toTimeString().slice(0, 5)
    const upcoming = items
      .filter(i => i.scheduled_time && i.status !== 'completed' && i.status !== 'skipped')
      .sort((a, b) => (a.scheduled_time as string).localeCompare(b.scheduled_time as string))
    nextUp = upcoming.find(i => (i.scheduled_time as string).slice(0, 5) > currentTime) ?? null
  }

  return NextResponse.json({ items, nextUp })
}
