import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TIME_OF_DAY: Record<string, { start: string; defaultDuration: number }> = {
  morning:          { start: '08:00', defaultDuration: 45 },
  afternoon:        { start: '13:00', defaultDuration: 60 },
  evening:          { start: '19:00', defaultDuration: 60 },
  anytime_this_week: { start: '09:00', defaultDuration: 30 },
}
const DEFAULT_SLOT = { start: '09:00', defaultDuration: 30 }

const CADENCE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, seasonal: 90, annual: 365,
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function minToHHMM(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Extract HH:MM (UTC) from an ISO timestamp or plain "HH:MM"
function extractTime(ts: string): string {
  const m = ts.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : ts.slice(0, 5)
}

// Convert a UTC Date object to local minutes-from-midnight using JS getTimezoneOffset() value.
// utcOffsetMin is positive for west of UTC (e.g. 420 for PDT).
function utcToLocalMin(ts: string, utcOffsetMin: number): number {
  const utcMin = timeToMin(extractTime(ts))
  // localMin = utcMin - utcOffsetMin; handle day wrap
  return ((utcMin - utcOffsetMin) % (24 * 60) + 24 * 60) % (24 * 60)
}

// Find the earliest start >= desiredStart that doesn't overlap any calendar event.
// All times are in LOCAL minutes-from-midnight.
// utcOffsetMin = new Date().getTimezoneOffset() on the client (positive = west of UTC).
async function findAvailableStart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  date: string,          // local date YYYY-MM-DD
  desiredStartMin: number,
  durationMin: number,
  utcOffsetMin: number,
): Promise<number> {
  // Query a UTC window that covers the full local day (±1 day to handle any timezone offset)
  const localMidnightUTC = new Date(`${date}T00:00:00Z`).getTime() + utcOffsetMin * 60_000
  const startISO = new Date(localMidnightUTC).toISOString()
  const endISO   = new Date(localMidnightUTC + 24 * 60 * 60 * 1_000).toISOString()

  const { data: events } = await supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .eq('is_all_day', false)
    .gte('start_time', startISO)
    .lt('start_time', endISO)
    .order('start_time')

  if (!events?.length) return desiredStartMin

  const busy = (events as { start_time: string; end_time: string }[])
    .map(ev => ({
      start: utcToLocalMin(ev.start_time, utcOffsetMin),
      end:   utcToLocalMin(ev.end_time,   utcOffsetMin),
    }))
    .sort((a, b) => a.start - b.start)

  let slot = desiredStartMin
  let changed = true
  while (changed) {
    changed = false
    const slotEnd = slot + durationMin
    for (const b of busy) {
      if (b.start < slotEnd && b.end > slot) {
        slot = b.end
        changed = true
        break
      }
    }
  }
  return slot
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { hopper_item_id, week_start, preferred_time: ptOverride, duration_minutes: durOverride, utc_offset_minutes, force } = body
  const utcOffMin: number = typeof utc_offset_minutes === 'number' ? utc_offset_minutes : 0

  if (!hopper_item_id || !week_start) {
    return NextResponse.json({ error: 'hopper_item_id and week_start are required' }, { status: 400 })
  }

  // Fetch hopper item
  const { data: hopperItem } = await supabase
    .from('hopper_items')
    .select('id, activity_id, raw_input, time_type')
    .eq('id', hopper_item_id)
    .eq('user_id', user.id)
    .single()

  if (!hopperItem) return NextResponse.json({ error: 'Hopper item not found' }, { status: 404 })

  // Fetch activity if linked
  let activity: {
    id: string; name: string; preferred_time: string | null; preferred_days: string[] | null
    frequency: string | null; duration_range_min: number | null; duration_range_max: number | null
    time_type: string | null; emotional_weight: string | null
  } | null = null

  if (hopperItem.activity_id) {
    const { data: act } = await supabase
      .from('activities')
      .select('id, name, preferred_time, preferred_days, frequency, duration_range_min, duration_range_max, time_type, emotional_weight')
      .eq('id', hopperItem.activity_id)
      .single()
    activity = act
  }

  // Resolve effective values (override → activity → default)
  const effectivePreferredTime = ptOverride ?? activity?.preferred_time ?? null
  const effectiveDuration = durOverride ?? activity?.duration_range_min ?? DEFAULT_SLOT.defaultDuration

  // Save overrides back to activity for next time
  if (activity && (ptOverride || durOverride)) {
    const patch: Record<string, unknown> = {}
    if (ptOverride) patch.preferred_time = ptOverride
    if (durOverride) {
      patch.duration_range_min = durOverride
      if (!activity.duration_range_max || activity.duration_range_max < durOverride) {
        patch.duration_range_max = durOverride
      }
    }
    await supabase.from('activities').update(patch).eq('id', activity.id)
  }

  // Build the 7 days of the target week
  const weekStartDate = new Date(week_start + 'T00:00:00')
  const allDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + i)
    return d
  })

  // Filter by preferred_days (e.g. ['Mon','Tue','Wed','Thu','Fri'])
  const preferredDays = activity?.preferred_days ?? []
  const filteredDays = preferredDays.length > 0
    ? allDays.filter(d => preferredDays.includes(DAY_SHORT[d.getDay()]))
    : allDays

  // For sub-weekly cadence take only the first matching day
  const frequency = activity?.frequency ?? 'daily'
  const cadenceDays = CADENCE_DAYS[frequency] ?? 1
  const targetDays = cadenceDays <= 1 ? filteredDays : filteredDays.slice(0, 1)

  // Normalize H:MM → HH:MM
  const normalizedTime = effectivePreferredTime?.replace(/^(\d):/, '0$1:') ?? null
  // Resolve time slot — exact HH:MM times bypass the named-slot lookup
  const isExactTime = /^\d{2}:\d{2}$/.test(normalizedTime ?? '')
  const slot = isExactTime ? null : (TIME_OF_DAY[normalizedTime ?? ''] ?? DEFAULT_SLOT)
  const startTime = isExactTime ? normalizedTime! : slot!.start

  const itemName = activity?.name ?? hopperItem.raw_input
  const timeType = activity?.time_type ?? hopperItem.time_type ?? 'B'
  const emotionalWeight = activity?.emotional_weight ?? 'normal'

  // Create a time block + schedule item for each target day
  const created = []
  for (const day of targetDays) {
    const scheduledDate = day.toISOString().split('T')[0]

    // Avoid calendar conflicts — find the first open slot >= desired start (unless forced)
    const desiredStartMin = timeToMin(startTime)
    const availableStartMin = force
      ? desiredStartMin
      : await findAvailableStart(supabase, user.id, scheduledDate, desiredStartMin, effectiveDuration, utcOffMin)
    const actualStartTime = minToHHMM(availableStartMin)
    const actualEndTime = addMinutes(actualStartTime, effectiveDuration)

    // Create the time block
    const { data: block } = await supabase
      .from('time_blocks')
      .insert({
        user_id: user.id,
        block_date: scheduledDate,
        label: itemName,
        start_time: actualStartTime,
        end_time: actualEndTime,
        duration_minutes: effectiveDuration,
        time_type: timeType,
        is_hard: false,
        sort_order: 0,
        source: 'auto_place',
      })
      .select()
      .single()
    if (!block) continue

    // Create the schedule item inside the block
    const { data: si } = await supabase
      .from('schedule_items')
      .insert({
        user_id: user.id,
        activity_id: hopperItem.activity_id ?? null,
        hopper_item_id: hopper_item_id,
        time_block_id: block.id,
        name: itemName,
        scheduled_date: scheduledDate,
        time_type: timeType,
        emotional_weight: emotionalWeight,
        bounding_type: 'action',
        status: 'active',
      })
      .select()
      .single()
    if (si) created.push({ block, item: si })
  }

  // Mark hopper item as activated
  await supabase
    .from('hopper_items')
    .update({ status: 'activated', resolved_at: new Date().toISOString() })
    .eq('id', hopper_item_id)
    .eq('user_id', user.id)

  return NextResponse.json({ created })
}
