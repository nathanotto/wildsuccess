'use client'
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { UserValue, LifeDomain, Activity } from '@/lib/types'
import EnrichmentCard from '@/components/capture/EnrichmentCard'

// ── Design constants ──────────────────────────────────────────────────────────
const HOUR_HEIGHT = 60
const GRID_START = 5
const GRID_END = 21
const GRID_HOURS = GRID_END - GRID_START
const GRID_HEIGHT = GRID_HOURS * HOUR_HEIGHT

const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Unwanted', D: 'Self-care', '0': 'Free' }
const TIER_COLORS: Record<string, string> = { urgent: '#C4725A', normal: '#2D2A26', suggested: '#B5B0A8' }

// ── Local types ───────────────────────────────────────────────────────────────
interface BlockType {
  id: string
  user_id: string
  name: string
  color: string
  default_duration_minutes: number
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  icon: string | null
  sort_order: number
  is_active: boolean
}

interface TimeBlockLocal {
  id: string
  block_date: string
  label: string
  start_time: string
  end_time: string
  duration_minutes: number
  is_hard: boolean
  block_type_id: string | null
  block_type?: BlockType
  source: string
  items: ScheduleItemLocal[]
}

interface ScheduleItemLocal {
  id: string
  name: string
  hopper_item_id: string | null
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  status: 'active' | 'completed' | 'skipped'
  committed_at?: string | null
}

interface HopperItemLocal {
  id: string
  name: string
  source: string
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  priority_tier: 'urgent' | 'normal' | 'suggested'
  priority_score: number
  block_type_hint: string | null
  duration_min: number
  duration_max: number
  values: string[]
  enrichment_status?: 'none' | 'pending' | 'enriched' | 'confirmed' | 'declined'
  enrichment_data?: Record<string, unknown> | null
  meta?: { requestedBy?: string }
}

interface CalEventLocal {
  id: string
  title: string
  display_label: string | null
  start_time: string
  end_time: string
  is_all_day: boolean
  external_series_id: string | null
  external_event_id: string
  classification: {
    classification: 'provisional' | 'info' | 'fixed_commitment' | 'flexible_commitment'
    display_label: string | null
  } | null
}

interface ClassifyState {
  event: CalEventLocal
  classification: 'info' | 'fixed_commitment' | 'flexible_commitment'
  displayLabel: string
  energyLevel: 'A' | 'B' | 'C' | 'D' | '0'
  applyToSeries: boolean
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void
  values: UserValue[]
  domains: LifeDomain[]
  activities: Activity[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1))
  dt.setHours(0, 0, 0, 0)
  return dt
}
function addDays(d: Date, n: number): Date {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + n)
  return dt
}
function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}
function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${ap}` : `${h12}:${m} ${ap}`
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SOURCE_LABELS: Record<string, string> = {
  template_proposal: 'Suggested',
  outside_request: 'Request',
  quick_capture: 'Captured',
  planning_function: 'From Plan',
}
const SOURCE_ICONS: Record<string, string> = {
  template_proposal: '◈',
  outside_request: '↗',
  quick_capture: '✎',
  planning_function: '◎',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OrganizeWeekModal({ onClose, values, domains }: Props) {
  // Core state
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [focusMinutes, setFocusMinutes] = useState(50)
  const [dayBlocks, setDayBlocks] = useState<Record<string, TimeBlockLocal[]>>({})
  const [hopper, setHopper] = useState<HopperItemLocal[]>([])
  const [calEvents, setCalEvents] = useState<CalEventLocal[]>([])
  const [calConnected, setCalConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  // UI state
  const [paletteShrunk, setPaletteShrunk] = useState(false)
  const [hopperShrunk, setHopperShrunk] = useState(false)
  const [summaryShrunk, setSummaryShrunk] = useState(false)
  const [hopperFilter, setHopperFilter] = useState('all')
  const [rightTab, setRightTab] = useState<'summary' | 'completed'>('summary')
  const [classifying, setClassifying] = useState<ClassifyState | null>(null)
  const [showBlockTypeEditor, setShowBlockTypeEditor] = useState(false)

  // Drag state
  const [draggingBlockTypeId, setDraggingBlockTypeId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [dragOverTime, setDragOverTime] = useState<string | null>(null)
  const [draggingHopperItem, setDraggingHopperItem] = useState<HopperItemLocal | null>(null)
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null)

  // Block resize
  const [resizing, setResizing] = useState<{
    blockId: string
    date: string
    startY: number
    initialStartMin: number
    initialEndMin: number
  } | null>(null)

  // Block drag (move or duplicate)
  const [draggingBlock, setDraggingBlock] = useState<{ block: TimeBlockLocal; date: string; isDuplicate: boolean } | null>(null)
  const [duplicateArmed, setDuplicateArmed] = useState<string | null>(null) // block id armed for duplication

  // Hopper item persist-drag (right-click to keep item in hopper after placing)
  const [hopperDuplicateArmed, setHopperDuplicateArmed] = useState<string | null>(null)

  // Capture
  const [captureInput, setCaptureInput] = useState('')
  const [enrichmentCards, setEnrichmentCards] = useState<Record<string, Record<string, unknown>>>({}) // hopperItemId → enrichment_data
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())

  // Hopper item edit (double-click)
  const [editingHopperId, setEditingHopperId] = useState<string | null>(null)

  // Block type editor state
  const [editingBlockTypes, setEditingBlockTypes] = useState<BlockType[]>([])

  // Refs
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const dragRafRef = useRef<number | null>(null)     // RAF handle for throttled drag-over
  const gridRectRef = useRef<DOMRect | null>(null)   // cached bounding rect during drag
  const dayBlocksRef = useRef(dayBlocks)             // stable ref for resize effect
  dayBlocksRef.current = dayBlocks                   // keep in sync without triggering effects

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const rangeStartForPropose = dateStr(weekStart)

      // Seed block types (idempotent) + generate proposals for this week
      await Promise.allSettled([
        fetch('/api/block-types/seed-defaults', { method: 'POST' }),
        fetch('/api/hopper/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week_start_date: rangeStartForPropose }),
        }),
      ])

      // After proposals are created, score them
      await fetch('/api/hopper/compute-priorities', { method: 'POST' })

      const rangeStart = rangeStartForPropose
      const rangeEnd = dateStr(addDays(weekStart, 6))

      const [
        btRes,
        tbRes,
        siRes,
        hopperRes,
        calRes,
        calSettingsRes,
      ] = await Promise.all([
        fetch('/api/block-types'),
        fetch(`/api/time-blocks?range_start=${rangeStart}&range_end=${rangeEnd}`),
        fetch(`/api/schedule?range_start=${rangeStart}&range_end=${rangeEnd}`),
        fetch('/api/hopper?status=pending'),
        fetch(`/api/calendar/events?start=${rangeStart}T00:00:00Z&end=${rangeEnd}T23:59:59Z`),
        fetch('/api/calendar/settings'),
      ])

      const [btData, tbData, siData, hopperData, calData, calSettings] = await Promise.all([
        btRes.ok ? btRes.json() : [],
        tbRes.ok ? tbRes.json() : [],
        siRes.ok ? siRes.json() : [],
        hopperRes.ok ? hopperRes.json() : [],
        calRes.ok ? calRes.json() : [],
        calSettingsRes.ok ? calSettingsRes.json() : { connected: false },
      ])

      const bts: BlockType[] = Array.isArray(btData) ? btData : []
      setBlockTypes(bts)
      setEditingBlockTypes(bts)

      // Build dayBlocks from time_blocks + schedule_items
      const blocks: TimeBlockLocal[] = Array.isArray(tbData) ? tbData : []
      const schedItems: Array<{
        id: string
        time_block_id?: string | null
        scheduled_date: string
        name: string
        hopper_item_id: string | null
        time_type: 'A' | 'B' | 'C' | 'D' | '0'
        emotional_weight: 'light' | 'normal' | 'heavy'
        status: 'active' | 'completed' | 'skipped'
        committed_at?: string | null
      }> = Array.isArray(siData) ? siData : []

      const newDayBlocks: Record<string, TimeBlockLocal[]> = {}
      for (const block of blocks) {
        const ds = block.block_date
        if (!newDayBlocks[ds]) newDayBlocks[ds] = []

        const blockItems: ScheduleItemLocal[] = schedItems
          .filter(si => si.time_block_id === block.id)
          .map(si => ({
            id: si.id,
            name: si.name,
            hopper_item_id: si.hopper_item_id,
            time_type: si.time_type,
            emotional_weight: si.emotional_weight,
            status: si.status,
          }))

        const startMin = block.start_time ? timeToMinutes(block.start_time) : GRID_START * 60
        const endMin = block.end_time ? timeToMinutes(block.end_time) : startMin + 60
        const duration = endMin - startMin

        newDayBlocks[ds].push({
          id: block.id,
          block_date: ds,
          label: block.label,
          start_time: block.start_time ?? minutesToTime(GRID_START * 60),
          end_time: block.end_time ?? minutesToTime(GRID_START * 60 + 60),
          duration_minutes: duration,
          is_hard: block.is_hard,
          block_type_id: (block as TimeBlockLocal & { block_type_id?: string | null }).block_type_id ?? null,
          block_type: bts.find(bt => bt.id === ((block as TimeBlockLocal & { block_type_id?: string | null }).block_type_id ?? '')) ?? undefined,
          source: block.source,
          items: blockItems,
        })
      }
      setDayBlocks(newDayBlocks)

      // Build hopper
      const activatedHopperIds = new Set(
        schedItems.map(si => si.hopper_item_id).filter(Boolean)
      )
      const rawHopper: Array<{
        id: string
        raw_input: string
        source: string
        status: string
        activity?: {
          time_type?: 'A' | 'B' | 'C' | 'D' | '0'
          emotional_weight?: 'light' | 'normal' | 'heavy'
          duration_range_min?: number | null
          duration_range_max?: number | null
        } | null
        metadata?: Record<string, unknown> | null
        priority_tier?: string
        priority_score?: number
        enrichment_status?: string
        enrichment_data?: Record<string, unknown> | null
      }> = Array.isArray(hopperData) ? hopperData : []

      const hopperItems: HopperItemLocal[] = rawHopper
        .filter(h => h.status === 'pending' && !activatedHopperIds.has(h.id))
        .map(h => {
          const ed = h.enrichment_data as Record<string, unknown> | null
          return {
            id: h.id,
            name: (ed?.suggested_name as string | null) ?? h.raw_input,
            source: h.source,
            time_type: ((ed?.suggested_time_type as string | null) ?? h.activity?.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
            emotional_weight: ((ed?.suggested_emotional_weight as string | null) ?? h.activity?.emotional_weight ?? 'normal') as 'light' | 'normal' | 'heavy',
            priority_tier: (h.priority_tier ?? 'normal') as 'urgent' | 'normal' | 'suggested',
            priority_score: h.priority_score ?? 50,
            block_type_hint: null,
            duration_min: (ed?.suggested_duration_min as number | null) ?? h.activity?.duration_range_min ?? 20,
            duration_max: (ed?.suggested_duration_max as number | null) ?? h.activity?.duration_range_max ?? 60,
            values: [],
            enrichment_status: (h.enrichment_status ?? 'none') as HopperItemLocal['enrichment_status'],
            enrichment_data: h.enrichment_data ?? null,
            meta: h.metadata as { requestedBy?: string } | undefined,
          }
        })
      setHopper(hopperItems)

      // Restore enrichment cards for items that are enriched but not yet confirmed
      const cardsFromLoad: Record<string, Record<string, unknown>> = {}
      rawHopper
        .filter(h => h.enrichment_status === 'enriched' && h.enrichment_data)
        .forEach(h => { cardsFromLoad[h.id] = h.enrichment_data! })
      setEnrichmentCards(cardsFromLoad)

      // Map cal events
      const rawCal: Array<{
        id: string
        title: string
        start_time: string
        end_time: string
        is_all_day: boolean
        external_series_id: string | null
        external_event_id: string
        classification?: {
          classification: 'provisional' | 'info' | 'fixed_commitment' | 'flexible_commitment'
          display_label: string | null
        } | null
      }> = Array.isArray(calData) ? calData : []

      setCalEvents(rawCal.map(ev => ({
        id: ev.id,
        title: ev.title,
        display_label: ev.classification?.display_label ?? null,
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_all_day: ev.is_all_day,
        external_series_id: ev.external_series_id,
        external_event_id: ev.external_event_id,
        classification: ev.classification ?? null,
      })))

      setCalConnected(calSettings?.connected === true)
    } catch (err) {
      console.error('OrganizeWeekModal loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Resize effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resizing) return

    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - resizing.startY
      const rawDelta = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15
      const newEndMin = Math.max(
        resizing.initialStartMin + 15,
        resizing.initialEndMin + rawDelta
      )
      const clampedEndMin = Math.min(GRID_END * 60, newEndMin)

      setDayBlocks(prev => {
        const dayList = prev[resizing.date] ?? []
        return {
          ...prev,
          [resizing.date]: dayList.map(b => {
            if (b.id !== resizing.blockId) return b
            const startMin = timeToMinutes(b.start_time)
            return {
              ...b,
              end_time: minutesToTime(clampedEndMin),
              duration_minutes: clampedEndMin - startMin,
            }
          }),
        }
      })
    }

    const onUp = async (e: MouseEvent) => {
      const dy = e.clientY - resizing.startY
      const rawDelta = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15
      const newEndMin = Math.min(GRID_END * 60, Math.max(resizing.initialStartMin + 15, resizing.initialEndMin + rawDelta))
      const endTime = minutesToTime(newEndMin)

      // Get current block to compute duration (use ref to avoid effect re-subscription)
      const allBlocks = Object.values(dayBlocksRef.current).flat()
      const block = allBlocks.find(b => b.id === resizing.blockId)
      if (block) {
        const startMin = timeToMinutes(block.start_time)
        await fetch(`/api/time-blocks/${resizing.blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ end_time: endTime, duration_minutes: newEndMin - startMin }),
        })
      }
      setResizing(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizing])

  // ── Time grid helpers ───────────────────────────────────────────────────────
  function getTimeFromClientY(clientY: number): string {
    const container = gridScrollRef.current
    if (!container) return '08:00'
    // Use cached rect during drag; re-read only if not cached
    const rect = gridRectRef.current ?? container.getBoundingClientRect()
    const y = Math.max(0, clientY - rect.top + container.scrollTop)
    const rawMinutes = GRID_START * 60 + (y / HOUR_HEIGHT) * 60
    const snapped = Math.round(rawMinutes / 30) * 30
    const h = Math.max(GRID_START, Math.min(GRID_END - 1, Math.floor(snapped / 60)))
    const m = snapped % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function blockTopPx(startTime: string): number {
    return (timeToMinutes(startTime) - GRID_START * 60) * (HOUR_HEIGHT / 60)
  }

  function blockHeightPx(durationMin: number): number {
    return Math.max(20, durationMin * (HOUR_HEIGHT / 60))
  }

  // ── Block placement ─────────────────────────────────────────────────────────
  async function handleDropOnColumn(ds: string, clientY: number) {
    if (!draggingBlockTypeId) return
    const blockType = blockTypes.find(bt => bt.id === draggingBlockTypeId)
    if (!blockType) return

    const snapTime = getTimeFromClientY(clientY)
    const duration = blockType.name === 'Focus' ? focusMinutes : blockType.default_duration_minutes
    const endTime = minutesToTime(timeToMinutes(snapTime) + duration)

    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: ds,
          label: blockType.name,
          start_time: snapTime,
          end_time: endTime,
          duration_minutes: duration,
          block_type_id: blockType.id,
          is_hard: false,
          sort_order: 0,
          source: 'manual',
          time_type: blockType.time_type,
        }),
      })
      if (!res.ok) return
      const newBlock = await res.json()
      setDayBlocks(prev => {
        const existing = prev[ds] ?? []
        return {
          ...prev,
          [ds]: [...existing, {
            id: newBlock.id,
            block_date: ds,
            label: blockType.name,
            start_time: snapTime,
            end_time: endTime,
            duration_minutes: duration,
            is_hard: false,
            block_type_id: blockType.id,
            block_type: blockType,
            source: 'manual',
            items: [],
          }],
        }
      })
    } catch (err) {
      console.error('Drop on column error:', err)
    }

    setDragOverCol(null)
    setDragOverTime(null)
    setDraggingBlockTypeId(null)
  }

  // ── Hopper drop directly on column (creates new block) ─────────────────────
  async function handleDropHopperOnColumn(ds: string, clientY: number) {
    if (!draggingHopperItem) return
    const item = draggingHopperItem
    const isPersist = hopperDuplicateArmed === item.id
    setHopperDuplicateArmed(null)

    const snapTime = getTimeFromClientY(clientY)
    const duration = item.duration_min > 0 ? item.duration_min : 60
    const endTime = minutesToTime(timeToMinutes(snapTime) + duration)

    // Find matching block type from hint
    const hintBt = item.block_type_hint
      ? blockTypes.find(bt => bt.name.toLowerCase() === item.block_type_hint!.toLowerCase())
      : null

    try {
      const blockRes = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: ds,
          label: item.name,
          start_time: snapTime,
          end_time: endTime,
          duration_minutes: duration,
          block_type_id: hintBt?.id ?? null,
          is_hard: false,
          sort_order: 0,
          source: 'manual',
          time_type: item.time_type,
        }),
      })
      if (!blockRes.ok) return
      const newBlock = await blockRes.json()

      const siRes = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          scheduled_date: ds,
          time_block_id: newBlock.id,
          flexibility: 'anytime_today',
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          hopper_item_id: isPersist ? null : item.id,
        }),
      })
      if (!siRes.ok) return
      const newSI = await siRes.json()

      const schedItem: ScheduleItemLocal = {
        id: newSI.id,
        name: item.name,
        hopper_item_id: isPersist ? null : item.id,
        time_type: item.time_type,
        emotional_weight: item.emotional_weight,
        status: 'active',
      }

      setDayBlocks(prev => {
        const existing = prev[ds] ?? []
        return {
          ...prev,
          [ds]: [...existing, {
            id: newBlock.id,
            block_date: ds,
            label: item.name,
            start_time: snapTime,
            end_time: endTime,
            duration_minutes: duration,
            is_hard: false,
            block_type_id: hintBt?.id ?? null,
            block_type: hintBt ?? undefined,
            source: 'manual',
            items: [schedItem],
          }],
        }
      })

      if (!isPersist) setHopper(prev => prev.filter(h => h.id !== item.id))
    } catch (err) {
      console.error('Hopper drop on column error:', err)
    }

    setDraggingHopperItem(null)
    setDragOverCol(null)
    setDragOverTime(null)
  }

  // ── Hopper drop on block ────────────────────────────────────────────────────
  async function handleDropOnBlock(block: TimeBlockLocal, ds: string) {
    if (!draggingHopperItem) return
    const item = draggingHopperItem
    const isPersist = hopperDuplicateArmed === item.id
    setHopperDuplicateArmed(null)

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          scheduled_date: ds,
          time_block_id: block.id,
          flexibility: 'anytime_today',
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          // When persisting, don't link to hopper item so it stays pending
          hopper_item_id: isPersist ? null : item.id,
        }),
      })
      if (!res.ok) return
      const newSI = await res.json()

      const schedItem: ScheduleItemLocal = {
        id: newSI.id,
        name: item.name,
        hopper_item_id: isPersist ? null : item.id,
        time_type: item.time_type,
        emotional_weight: item.emotional_weight,
        status: 'active',
      }

      const isFirst = block.items.length === 0
      if (isFirst) {
        fetch(`/api/time-blocks/${block.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: item.name }),
        })
      }

      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return {
          ...prev,
          [ds]: dayList.map(b =>
            b.id === block.id
              ? { ...b, label: isFirst ? item.name : b.label, items: [...b.items, schedItem] }
              : b
          ),
        }
      })

      // Only consume hopper item if not in persist mode
      if (!isPersist) setHopper(prev => prev.filter(h => h.id !== item.id))
    } catch (err) {
      console.error('Drop on block error:', err)
    }

    setDraggingHopperItem(null)
    setDragOverBlockId(null)
  }

  // ── Return to hopper ────────────────────────────────────────────────────────
  async function returnToHopper(item: ScheduleItemLocal, block: TimeBlockLocal, ds: string) {
    try {
      await fetch(`/api/schedule/${item.id}`, { method: 'DELETE' })
      if (item.hopper_item_id) {
        await fetch(`/api/hopper/${item.hopper_item_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' }),
        })
      }

      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return {
          ...prev,
          [ds]: dayList.map(b =>
            b.id === block.id ? { ...b, items: b.items.filter(i => i.id !== item.id) } : b
          ),
        }
      })

      if (item.hopper_item_id) {
        const hopperItem: HopperItemLocal = {
          id: item.hopper_item_id,
          name: item.name,
          source: 'quick_capture',
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          priority_tier: 'normal',
          priority_score: 50,
          block_type_hint: null,
          duration_min: 20,
          duration_max: 60,
          values: [],
        }
        setHopper(prev => [hopperItem, ...prev])
      }
    } catch (err) {
      console.error('Return to hopper error:', err)
    }
  }

  // ── Mark complete ───────────────────────────────────────────────────────────
  async function markItemComplete(item: ScheduleItemLocal, block: TimeBlockLocal, ds: string) {
    try {
      await fetch(`/api/schedule/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return {
          ...prev,
          [ds]: dayList.map(b =>
            b.id === block.id
              ? { ...b, items: b.items.map(i => i.id === item.id ? { ...i, status: 'completed' as const } : i) }
              : b
          ),
        }
      })
    } catch (err) {
      console.error('Mark complete error:', err)
    }
  }

  // ── Dismiss hopper item ─────────────────────────────────────────────────────
  async function dismissHopperItem(id: string) {
    try {
      await fetch(`/api/hopper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', resolved_at: new Date().toISOString() }),
      })
      setHopper(prev => prev.filter(h => h.id !== id))
    } catch (err) {
      console.error('Dismiss hopper error:', err)
    }
  }

  // ── Delete block ────────────────────────────────────────────────────────────
  async function deleteBlock(blockId: string, ds: string) {
    try {
      await fetch(`/api/time-blocks/${blockId}`, { method: 'DELETE' })
      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return { ...prev, [ds]: dayList.filter(b => b.id !== blockId) }
      })
    } catch (err) {
      console.error('Delete block error:', err)
    }
  }

  // Move block to a new day/time, preserving duration and items
  async function moveBlock(block: TimeBlockLocal, fromDate: string, toDate: string, newStartTime: string) {
    const newEndTime = minutesToTime(timeToMinutes(newStartTime) + block.duration_minutes)
    try {
      await fetch(`/api/time-blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block_date: toDate, start_time: newStartTime, end_time: newEndTime }),
      })
      setDayBlocks(prev => {
        const fromList = (prev[fromDate] ?? []).filter(b => b.id !== block.id)
        const moved: TimeBlockLocal = { ...block, block_date: toDate, start_time: newStartTime, end_time: newEndTime }
        if (fromDate === toDate) {
          return { ...prev, [fromDate]: [...fromList, moved] }
        }
        const toList = [...(prev[toDate] ?? []), moved]
        return { ...prev, [fromDate]: fromList, [toDate]: toList }
      })
    } catch (err) {
      console.error('Move block error:', err)
    }
  }

  // Duplicate block (and its items) to a new day/time; original stays
  async function duplicateBlock(block: TimeBlockLocal, toDate: string, newStartTime: string) {
    const newEndTime = minutesToTime(timeToMinutes(newStartTime) + block.duration_minutes)
    try {
      const res = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: toDate,
          label: block.label,
          start_time: newStartTime,
          end_time: newEndTime,
          duration_minutes: block.duration_minutes,
          block_type_id: block.block_type_id,
          is_hard: false,
          sort_order: 0,
          source: 'manual',
          time_type: block.block_type?.time_type ?? 'B',
        }),
      })
      if (!res.ok) return
      const newBlock = await res.json()

      // Duplicate each schedule item onto the new block (new IDs, no hopper link)
      const newItems: ScheduleItemLocal[] = []
      await Promise.all(block.items.map(async item => {
        const siRes = await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            scheduled_date: toDate,
            time_block_id: newBlock.id,
            flexibility: 'anytime_today',
            time_type: item.time_type,
            emotional_weight: item.emotional_weight,
          }),
        })
        if (siRes.ok) {
          const si = await siRes.json()
          newItems.push({
            id: si.id,
            name: item.name,
            hopper_item_id: null,
            time_type: item.time_type,
            emotional_weight: item.emotional_weight,
            status: 'active',
          })
        }
      }))

      setDayBlocks(prev => ({
        ...prev,
        [toDate]: [...(prev[toDate] ?? []), {
          id: newBlock.id,
          block_date: toDate,
          label: block.label,
          start_time: newStartTime,
          end_time: newEndTime,
          duration_minutes: block.duration_minutes,
          is_hard: false,
          block_type_id: block.block_type_id,
          block_type: block.block_type,
          source: 'manual',
          items: newItems,
        }],
      }))
    } catch (err) {
      console.error('Duplicate block error:', err)
    }
  }

  // Delete block and return all its items to the hopper
  async function deleteBlockWithItems(block: TimeBlockLocal, ds: string) {
    try {
      // Return each item to hopper first
      await Promise.all(block.items.map(async item => {
        await fetch(`/api/schedule/${item.id}`, { method: 'DELETE' })
        if (item.hopper_item_id) {
          await fetch(`/api/hopper/${item.hopper_item_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
          })
        }
      }))
      await fetch(`/api/time-blocks/${block.id}`, { method: 'DELETE' })

      setDayBlocks(prev => ({
        ...prev,
        [ds]: (prev[ds] ?? []).filter(b => b.id !== block.id),
      }))

      // Restore items in hopper state
      const returning: HopperItemLocal[] = block.items
        .filter(item => item.hopper_item_id)
        .map(item => ({
          id: item.hopper_item_id!,
          name: item.name,
          source: 'quick_capture' as const,
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          priority_tier: 'normal' as const,
          priority_score: 50,
          block_type_hint: null,
          duration_min: 20,
          duration_max: 60,
          values: [],
        }))
      if (returning.length > 0) setHopper(prev => [...returning, ...prev])
    } catch (err) {
      console.error('Delete block with items error:', err)
    }
  }

  // ── Quick capture ───────────────────────────────────────────────────────────
  async function handleQuickCapture(e: React.FormEvent) {
    e.preventDefault()
    const text = captureInput.trim()
    if (!text) return
    setCaptureInput('')
    try {
      const res = await fetch('/api/hopper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: text, source: 'quick_capture' }),
      })
      if (!res.ok) return
      const newItem = await res.json()
      const hopperItem: HopperItemLocal = {
        id: newItem.id,
        name: text,
        source: 'quick_capture',
        time_type: 'B',
        emotional_weight: 'normal',
        priority_tier: 'normal',
        priority_score: 50,
        block_type_hint: null,
        duration_min: 20,
        duration_max: 60,
        values: [],
        enrichment_status: 'pending',
      }
      setHopper(prev => [...prev, hopperItem])

      // Fire enrichment in background
      setEnrichingIds(prev => new Set(prev).add(newItem.id))
      fetch('/api/capture/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hopper_item_id: newItem.id }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && !data.error) {
            setEnrichmentCards(prev => ({ ...prev, [newItem.id]: data }))
            setHopper(prev => prev.map(h =>
              h.id === newItem.id
                ? { ...h, enrichment_status: 'enriched', name: data.suggested_name ?? h.name }
                : h
            ))
          } else {
            setHopper(prev => prev.map(h =>
              h.id === newItem.id ? { ...h, enrichment_status: 'none' } : h
            ))
          }
        })
        .catch(() => {
          setHopper(prev => prev.map(h =>
            h.id === newItem.id ? { ...h, enrichment_status: 'none' } : h
          ))
        })
        .finally(() => setEnrichingIds(prev => { const s = new Set(prev); s.delete(newItem.id); return s }))
    } catch (err) {
      console.error('Quick capture error:', err)
    }
  }

  function buildEditEnrichment(item: HopperItemLocal): Record<string, unknown> {
    if (item.enrichment_data) return item.enrichment_data
    return {
      match_type: 'new_template',
      matched_activity_id: null,
      matched_activity_name: null,
      suggested_name: item.name,
      suggested_description: null,
      suggested_life_domain_id: null,
      suggested_life_domain_name: null,
      suggested_value_links: [],
      suggested_big_outcome_id: null,
      suggested_big_outcome_name: null,
      suggested_time_type: item.time_type,
      suggested_emotional_weight: item.emotional_weight,
      suggested_context: [],
      suggested_block_type_id: null,
      suggested_block_type_name: null,
      suggested_recurrence: null,
      suggested_preferred_days: null,
      suggested_preferred_time: null,
      suggested_duration_min: item.duration_min || null,
      suggested_duration_max: item.duration_max || null,
      suggested_flexibility: 'anytime_this_week',
      suggested_is_preventive: false,
      confidence: 0,
      reasoning: '',
    }
  }

  async function handleEnrichmentConfirm(hopperItemId: string, data: Record<string, unknown>) {
    setEnrichmentCards(prev => { const s = { ...prev }; delete s[hopperItemId]; return s })
    await fetch('/api/capture/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hopper_item_id: hopperItemId, enrichment_data: data }),
    })
    setHopper(prev => prev.map(h => h.id === hopperItemId ? { ...h, enrichment_status: 'confirmed' } : h))
  }

  async function handleEnrichmentDecline(hopperItemId: string) {
    setEnrichmentCards(prev => { const s = { ...prev }; delete s[hopperItemId]; return s })
    await fetch('/api/capture/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hopper_item_id: hopperItemId }),
    })
    setHopper(prev => prev.map(h => h.id === hopperItemId ? { ...h, enrichment_status: 'declined' } : h))
  }

  const handleEnrichItem = useCallback((itemId: string) => {
    setEnrichingIds(prev => new Set(prev).add(itemId))
    setHopper(prev => prev.map(h => h.id === itemId ? { ...h, enrichment_status: 'pending' } : h))
    fetch('/api/capture/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hopper_item_id: itemId }) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) {
          setEnrichmentCards(prev => ({ ...prev, [itemId]: data }))
          setHopper(prev => prev.map(h => h.id === itemId ? { ...h, enrichment_status: 'enriched', name: data.suggested_name ?? h.name } : h))
        } else {
          setHopper(prev => prev.map(h => h.id === itemId ? { ...h, enrichment_status: 'none' } : h))
        }
      })
      .catch(() => setHopper(prev => prev.map(h => h.id === itemId ? { ...h, enrichment_status: 'none' } : h)))
      .finally(() => setEnrichingIds(prev => { const s = new Set(prev); s.delete(itemId); return s }))
  }, [])

  // ── Start resize ────────────────────────────────────────────────────────────
  function startResize(e: React.MouseEvent, block: TimeBlockLocal, ds: string) {
    e.preventDefault()
    e.stopPropagation()
    setResizing({
      blockId: block.id,
      date: ds,
      startY: e.clientY,
      initialStartMin: timeToMinutes(block.start_time),
      initialEndMin: timeToMinutes(block.end_time),
    })
  }

  // ── Calendar classification ─────────────────────────────────────────────────
  async function saveClassification() {
    if (!classifying) return
    const { event, classification, displayLabel, energyLevel, applyToSeries } = classifying

    const matchKey = applyToSeries && event.external_series_id
      ? event.external_series_id
      : event.external_event_id
    const matchType = applyToSeries && event.external_series_id ? 'series' : 'event'

    try {
      await fetch('/api/calendar/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_key: matchKey,
          match_type: matchType,
          classification,
          display_label: displayLabel || null,
          time_type: energyLevel,
        }),
      })

      if (classification === 'fixed_commitment') {
        const startParts = event.start_time.replace('Z', '').split('T')
        const eventDate = startParts[0]
        const startT = startParts[1]?.substring(0, 5) ?? '09:00'
        const endParts = event.end_time.replace('Z', '').split('T')
        const endT = endParts[1]?.substring(0, 5) ?? '10:00'
        await fetch('/api/time-blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_date: eventDate,
            label: displayLabel || event.title,
            start_time: startT,
            end_time: endT,
            is_hard: true,
            source: 'calendar_import',
            time_type: energyLevel,
          }),
        })
      } else if (classification === 'flexible_commitment') {
        await fetch('/api/hopper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raw_input: displayLabel || event.title,
            source: 'outside_request',
          }),
        })
      }

      await loadData()
    } catch (err) {
      console.error('Classify error:', err)
    }
    setClassifying(null)
  }

  // ── Block type editor save ──────────────────────────────────────────────────
  async function saveBlockType(bt: BlockType) {
    try {
      await fetch(`/api/block-types/${bt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bt.name,
          color: bt.color,
          default_duration_minutes: bt.default_duration_minutes,
          time_type: bt.time_type,
        }),
      })
      setBlockTypes(prev => prev.map(b => b.id === bt.id ? bt : b))
    } catch (err) {
      console.error('Save block type error:', err)
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const today = todayStr()

  const weekLabel = useMemo(() => {
    const start = weekStart
    const end = addDays(weekStart, 6)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (start.getMonth() === end.getMonth()) {
      return `${months[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
    }
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`
  }, [weekStart])

  const allScheduledItems = useMemo(
    () => Object.values(dayBlocks).flat().flatMap(b => b.items),
    [dayBlocks]
  )
  const completedItems = useMemo(
    () => allScheduledItems.filter(i => i.status === 'completed'),
    [allScheduledItems]
  )
  const energyCounts = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, '0': 0 }
    allScheduledItems.forEach(i => { counts[i.time_type] = (counts[i.time_type] ?? 0) + 1 })
    return counts
  }, [allScheduledItems])

  const dayItemCounts = useMemo(() => weekDates.map(d => {
    const ds = dateStr(d)
    const blocks = dayBlocks[ds] ?? []
    return blocks.reduce((s, b) => s + b.items.filter(i => i.status !== 'completed').length, 0)
  }), [weekDates, dayBlocks])
  const maxDayCount = useMemo(() => Math.max(1, ...dayItemCounts), [dayItemCounts])

  const filteredHopper = useMemo(() => hopper.filter(item => {
    if (hopperFilter === 'all') return true
    return item.time_type === hopperFilter
  }), [hopper, hopperFilter])

  const urgentHopper = useMemo(() => filteredHopper.filter(i => i.priority_tier === 'urgent'), [filteredHopper])
  const normalHopper = useMemo(() => filteredHopper.filter(i => i.priority_tier === 'normal'), [filteredHopper])
  const suggestedHopper = useMemo(() => filteredHopper.filter(i => i.priority_tier === 'suggested'), [filteredHopper])

  // Completed items by day for Done tab
  const completedByDay = useMemo(() => {
    const byDay: Record<string, Array<{ item: ScheduleItemLocal; blockLabel: string }>> = {}
    weekDates.forEach(d => {
      const ds = dateStr(d)
      const blocks = dayBlocks[ds] ?? []
      blocks.forEach(block => {
        block.items.filter(i => i.status === 'completed').forEach(item => {
          if (!byDay[ds]) byDay[ds] = []
          byDay[ds].push({ item, blockLabel: block.label })
        })
      })
    })
    return byDay
  }, [weekDates, dayBlocks])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(45,42,38,0.25)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '97vw',
          height: '95vh',
          maxWidth: 1600,
          borderRadius: 16,
          background: '#FAFAF7',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(45,42,38,0.18)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid #E8E4DC',
          flexShrink: 0,
          background: '#FAFAF7',
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#2D2A26', letterSpacing: '-0.2px' }}>
            Organize
          </span>
          <span style={{ color: '#8A857D', fontSize: 13 }}>{weekLabel}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => setWeekStart(d => addDays(d, -7))}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#5A5650' }}
            >←</button>
            <button
              onClick={() => setWeekStart(getMondayOf(new Date()))}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#5A5650' }}
            >Today</button>
            <button
              onClick={() => setWeekStart(d => addDays(d, 7))}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#5A5650' }}
            >→</button>
          </div>
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: calConnected ? '#5A9E6F' : '#D0CBC3',
            }} />
            <span style={{ fontSize: 11, color: '#8A857D' }}>
              {calConnected ? 'Cal synced' : 'No calendar'}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          {loading && (
            <span style={{ fontSize: 11, color: '#B5B0A8', marginRight: 8 }}>Loading…</span>
          )}
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        {/* ── Block Type Palette ──────────────────────────────────────────── */}
        {!paletteShrunk ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            flexWrap: 'wrap',
            borderBottom: '1px solid #E8E4DC',
            flexShrink: 0,
            background: '#F7F5F0',
          }}>
            {blockTypes.filter(bt => bt.is_active).map(bt => (
              <div
                key={bt.id}
                draggable
                onDragStart={e => {
                  setDraggingBlockTypeId(bt.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDragEnd={() => setDraggingBlockTypeId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 20,
                  border: `1.5px solid ${bt.color}40`,
                  borderLeft: `3px solid ${bt.color}`,
                  background: '#FFFFFF',
                  cursor: 'grab',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#2D2A26',
                  userSelect: 'none',
                  boxShadow: draggingBlockTypeId === bt.id ? `0 2px 8px ${bt.color}30` : undefined,
                  opacity: draggingBlockTypeId && draggingBlockTypeId !== bt.id ? 0.5 : 1,
                }}
              >
                {bt.icon && <span>{bt.icon}</span>}
                <span>{bt.name}</span>
                <span style={{ fontSize: 10, color: '#8A857D', marginLeft: 2 }}>
                  {bt.name === 'Focus' ? `${focusMinutes}m` : `${bt.default_duration_minutes}m`}
                </span>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: EC[bt.time_type],
                  display: 'inline-block',
                  flexShrink: 0,
                }} title={EL[bt.time_type]} />
              </div>
            ))}
            <div style={{ flex: 1 }} />
            {blockTypes.find(bt => bt.name === 'Focus') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8A857D' }}>Focus:</span>
                <select
                  value={focusMinutes}
                  onChange={e => setFocusMinutes(Number(e.target.value))}
                  style={{ fontSize: 11, border: '1px solid #E0DDD6', borderRadius: 4, padding: '2px 4px', background: 'transparent', color: '#2D2A26', cursor: 'pointer' }}
                >
                  {[25, 30, 40, 50, 60, 90].map(m => (
                    <option key={m} value={m}>{m}m</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setShowBlockTypeEditor(v => !v)}
              title="Edit block types"
              style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid #E0DDD6', background: showBlockTypeEditor ? '#EDE9E1' : 'transparent', cursor: 'pointer', fontSize: 13, color: '#5A5650' }}
            >⚙</button>
            <button
              onClick={() => setPaletteShrunk(true)}
              title="Collapse palette"
              style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#8A857D' }}
            >▲</button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 16px',
            borderBottom: '1px solid #E8E4DC',
            flexShrink: 0,
            background: '#F7F5F0',
            cursor: 'pointer',
          }}
            onClick={() => setPaletteShrunk(false)}
          >
            <span style={{ fontSize: 11, color: '#8A857D' }}>Block Types</span>
            <span style={{ fontSize: 10, color: '#B5B0A8' }}>▼ expand</span>
          </div>
        )}

        {/* ── Block Type Editor ───────────────────────────────────────────── */}
        {showBlockTypeEditor && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E8E4DC',
            background: '#F2F0EC',
            flexShrink: 0,
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5650', marginBottom: 8 }}>
              Block Type Editor
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {editingBlockTypes.map(bt => (
                <div key={bt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: bt.color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
                  <input
                    value={bt.name}
                    onChange={e => setEditingBlockTypes(prev => prev.map(b => b.id === bt.id ? { ...b, name: e.target.value } : b))}
                    onBlur={() => saveBlockType(editingBlockTypes.find(b => b.id === bt.id) ?? bt)}
                    style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '3px 6px', width: 120, background: '#FFF' }}
                  />
                  <input
                    type="number"
                    value={bt.default_duration_minutes}
                    onChange={e => setEditingBlockTypes(prev => prev.map(b => b.id === bt.id ? { ...b, default_duration_minutes: Number(e.target.value) } : b))}
                    onBlur={() => saveBlockType(editingBlockTypes.find(b => b.id === bt.id) ?? bt)}
                    style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '3px 6px', width: 60, background: '#FFF' }}
                  />
                  <span style={{ fontSize: 10, color: '#8A857D' }}>min</span>
                  <select
                    value={bt.time_type}
                    onChange={e => {
                      const updated = { ...bt, time_type: e.target.value as 'A' | 'B' | 'C' | 'D' | '0' }
                      setEditingBlockTypes(prev => prev.map(b => b.id === bt.id ? updated : b))
                      saveBlockType(updated)
                    }}
                    style={{ fontSize: 11, border: '1px solid #E0DDD6', borderRadius: 4, padding: '2px 4px', background: '#FFF' }}
                  >
                    <option value="A">A Focus</option>
                    <option value="B">B Routine</option>
                    <option value="C">C Unwanted</option>
                    <option value="D">D Self-care</option>
                    <option value="0">0 Free</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Body: 3-panel layout ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ── Hopper Panel ─────────────────────────────────────────────── */}
          {hopperShrunk ? (
            <div
              onClick={() => setHopperShrunk(false)}
              style={{
                width: 40,
                borderRight: '1px solid #E8E4DC',
                background: '#F7F5F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 9, color: '#8A857D', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 1 }}>
                HOPPER
              </span>
              {hopper.length > 0 && (
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#C4725A', color: '#FFF', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {hopper.length > 9 ? '9+' : hopper.length}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                width: 300,
                borderRight: '1px solid #E8E4DC',
                background: draggingBlock ? '#FFF4EE' : '#F7F5F0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'background 0.15s',
                outline: draggingBlock ? '2px dashed #C4725A50' : 'none',
                outlineOffset: -2,
              }}
              onDragOver={draggingBlock ? e => e.preventDefault() : undefined}
              onDrop={draggingBlock ? e => {
                e.preventDefault()
                const { block, date, isDuplicate } = draggingBlock
                setDraggingBlock(null)
                if (!isDuplicate) deleteBlockWithItems(block, date)
                // duplicate dropped on hopper = cancel, original untouched
              } : undefined}
            >
              {/* Hopper header */}
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #E8E4DC', flexShrink: 0 }}>
                {draggingBlock && (
                  <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: '#C4725A15', border: '1px dashed #C4725A60', fontSize: 11, color: '#C4725A', textAlign: 'center' }}>
                    Drop here to delete block
                    {draggingBlock.block.items.length > 0 && ` · ${draggingBlock.block.items.length} item${draggingBlock.block.items.length > 1 ? 's' : ''} return to hopper`}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#2D2A26' }}>Hopper</span>
                  <span style={{ fontSize: 11, background: '#E8E4DC', borderRadius: 10, padding: '1px 7px', color: '#5A5650', fontWeight: 600 }}>
                    {hopper.length}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setHopperShrunk(true)}
                    style={{ padding: '2px 6px', borderRadius: 5, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#8A857D' }}
                  >◀</button>
                </div>
                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['all', 'A', 'B', 'C', 'D', '0'].map(f => (
                    <button
                      key={f}
                      onClick={() => setHopperFilter(f)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: `1px solid ${hopperFilter === f ? EC[f] ?? '#2D2A26' : '#E0DDD6'}`,
                        background: hopperFilter === f ? (EC[f] ? EC[f] + '15' : '#2D2A2615') : 'transparent',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 500,
                        color: hopperFilter === f ? (EC[f] ?? '#2D2A26') : '#8A857D',
                      }}
                    >
                      {f === 'all' ? 'All' : EL[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hopper items */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                {loading && hopper.length === 0 && (
                  <div style={{ color: '#B5B0A8', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>Loading…</div>
                )}
                {!loading && filteredHopper.length === 0 && (
                  <div style={{ color: '#B5B0A8', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>
                    {hopper.length === 0 ? 'Hopper is empty' : 'No items match filter'}
                  </div>
                )}

                {/* Urgent tier */}
                {urgentHopper.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#C4725A', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                      URGENT
                    </div>
                    {urgentHopper.map(item => (
                      <HopperItemCard
                        key={item.id}
                        item={item}
                        onDismiss={() => dismissHopperItem(item.id)}
                        onDragStart={() => setDraggingHopperItem(item)}
                        onDragEnd={() => { setDraggingHopperItem(null); setHopperDuplicateArmed(null) }}
                        onContextMenu={e => { e.preventDefault(); setHopperDuplicateArmed(prev => prev === item.id ? null : item.id) }}
                        onDoubleClick={() => setEditingHopperId(item.id)}
                        onEnrich={() => handleEnrichItem(item.id)}
                        dragging={draggingHopperItem?.id === item.id}
                        armed={hopperDuplicateArmed === item.id}
                      />
                    ))}
                  </div>
                )}

                {/* Normal tier */}
                {normalHopper.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {urgentHopper.length > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8A857D', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                        TO DO
                      </div>
                    )}
                    {normalHopper.map(item => (
                      <HopperItemCard
                        key={item.id}
                        item={item}
                        onDismiss={() => dismissHopperItem(item.id)}
                        onDragStart={() => setDraggingHopperItem(item)}
                        onDragEnd={() => { setDraggingHopperItem(null); setHopperDuplicateArmed(null) }}
                        onContextMenu={e => { e.preventDefault(); setHopperDuplicateArmed(prev => prev === item.id ? null : item.id) }}
                        onDoubleClick={() => setEditingHopperId(item.id)}
                        onEnrich={() => handleEnrichItem(item.id)}
                        dragging={draggingHopperItem?.id === item.id}
                        armed={hopperDuplicateArmed === item.id}
                      />
                    ))}
                  </div>
                )}

                {/* Suggested tier */}
                {suggestedHopper.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#B5B0A8', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                      SUGGESTED
                    </div>
                    {suggestedHopper.map(item => (
                      <HopperItemCard
                        key={item.id}
                        item={item}
                        onDismiss={() => dismissHopperItem(item.id)}
                        onDragStart={() => setDraggingHopperItem(item)}
                        onDragEnd={() => { setDraggingHopperItem(null); setHopperDuplicateArmed(null) }}
                        onContextMenu={e => { e.preventDefault(); setHopperDuplicateArmed(prev => prev === item.id ? null : item.id) }}
                        onDoubleClick={() => setEditingHopperId(item.id)}
                        dragging={draggingHopperItem?.id === item.id}
                        armed={hopperDuplicateArmed === item.id}
                        muted
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Enrichment cards */}
              {Object.keys(enrichmentCards).length > 0 && (
                <div style={{ padding: '8px 10px', borderTop: '1px solid #E8E4DC', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  {Object.entries(enrichmentCards).map(([hopperItemId, data]) => (
                    <EnrichmentCard
                      key={hopperItemId}
                      hopperItemId={hopperItemId}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      enrichmentData={data as any}
                      domains={(domains ?? []).map(d => ({ id: d.id, name: d.name }))}
                      values={(values ?? []).map(v => ({ id: v.id, name: v.name }))}
                      outcomes={[]}
                      blockTypes={blockTypes.map(bt => ({ id: bt.id, name: bt.name }))}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onConfirm={(id, ed) => handleEnrichmentConfirm(id, ed as any)}
                      onDecline={handleEnrichmentDecline}
                    />
                  ))}
                </div>
              )}

              {/* Quick capture */}
              <div style={{ padding: '8px 10px', borderTop: '1px solid #E8E4DC', flexShrink: 0 }}>
                <form onSubmit={handleQuickCapture} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={captureInput}
                    onChange={e => setCaptureInput(e.target.value)}
                    placeholder="Quick capture…"
                    style={{
                      flex: 1, fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 8,
                      padding: '6px 10px', background: '#FFF', color: '#2D2A26',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!captureInput.trim()}
                    style={{
                      padding: '6px 10px', borderRadius: 8, border: 'none',
                      background: captureInput.trim() ? '#2D2A26' : '#E8E4DC',
                      color: captureInput.trim() ? '#FFF' : '#B5B0A8',
                      cursor: captureInput.trim() ? 'pointer' : 'default',
                      fontSize: 13, fontWeight: 600,
                    }}
                  >+</button>
                </form>
              </div>
            </div>
          )}

          {/* ── Center: Time Grid ─────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Day headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E8E4DC', flexShrink: 0, background: '#FAFAF7' }}>
              {/* Hour label offset */}
              <div style={{ width: 48, flexShrink: 0 }} />
              {weekDates.map((d, i) => {
                const ds = dateStr(d)
                const isToday = ds === today
                const blockCount = (dayBlocks[ds] ?? []).length
                return (
                  <div
                    key={ds}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      textAlign: 'center',
                      borderLeft: i === 0 ? 'none' : '1px solid #F0EDE8',
                    }}
                  >
                    <div style={{
                      fontSize: 11,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#C4725A' : '#5A5650',
                    }}>
                      {DAY_LABELS[i]}
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#C4725A' : '#2D2A26',
                      lineHeight: 1.2,
                    }}>
                      {d.getDate()}
                    </div>
                    {blockCount > 0 && (
                      <div style={{ fontSize: 9, color: '#B5B0A8', marginTop: 1 }}>{blockCount} block{blockCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Scrollable grid */}
            <div
              ref={gridScrollRef}
              style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
              onClick={() => { if (duplicateArmed) setDuplicateArmed(null) }}
            >
              <div style={{ display: 'flex', height: GRID_HEIGHT, position: 'relative' }}>

                {/* Hour labels */}
                <div style={{ width: 48, flexShrink: 0, position: 'relative', borderRight: '1px solid #F0EDE8' }}>
                  {Array.from({ length: GRID_HOURS + 1 }, (_, i) => {
                    const hour = GRID_START + i
                    if (hour > GRID_END) return null
                    const label = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`
                    return (
                      <div
                        key={hour}
                        style={{
                          position: 'absolute',
                          top: i * HOUR_HEIGHT - 8,
                          right: 6,
                          fontSize: 9,
                          color: '#B5B0A8',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>

                {/* Day columns */}
                {weekDates.map((d, colIdx) => {
                  const ds = dateStr(d)
                  const isToday = ds === today
                  const blocks = dayBlocks[ds] ?? []
                  const dayCalEvents = calEvents.filter(ev => {
                    const evDate = ev.start_time.split('T')[0]
                    return evDate === ds && !ev.is_all_day
                  })

                  const showPlaceholder = (draggingBlockTypeId || draggingBlock || draggingHopperItem) && dragOverCol === ds && dragOverTime
                  const placeholderBt = draggingBlockTypeId
                    ? blockTypes.find(bt => bt.id === draggingBlockTypeId)
                    : null
                  const placeholderColor = draggingBlock
                    ? (draggingBlock.block.block_type?.color ?? '#4B82AF')
                    : draggingHopperItem
                      ? (EC[draggingHopperItem.time_type] ?? '#4B82AF')
                      : (placeholderBt?.color ?? '#4B82AF')
                  const placeholderDuration = draggingBlock
                    ? draggingBlock.block.duration_minutes
                    : draggingHopperItem
                      ? (draggingHopperItem.duration_min > 0 ? draggingHopperItem.duration_min : 60)
                      : (placeholderBt
                          ? (placeholderBt.name === 'Focus' ? focusMinutes : placeholderBt.default_duration_minutes)
                          : 60)

                  return (
                    <div
                      key={ds}
                      style={{
                        flex: 1,
                        position: 'relative',
                        borderLeft: colIdx === 0 ? 'none' : '1px solid #F0EDE8',
                        background: isToday ? '#FDFCF9' : 'transparent',
                      }}
                      onDragOver={e => {
                        e.preventDefault()
                        if (draggingBlockTypeId || draggingBlock || draggingHopperItem) {
                          const clientY = e.clientY
                          if (dragRafRef.current !== null) return // already scheduled
                          dragRafRef.current = requestAnimationFrame(() => {
                            dragRafRef.current = null
                            // Cache rect once per drag gesture
                            if (!gridRectRef.current && gridScrollRef.current) {
                              gridRectRef.current = gridScrollRef.current.getBoundingClientRect()
                            }
                            setDragOverCol(ds)
                            setDragOverTime(getTimeFromClientY(clientY))
                          })
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverCol === ds) {
                          setDragOverCol(null)
                          setDragOverTime(null)
                          gridRectRef.current = null
                        }
                      }}
                      onDrop={e => {
                        e.preventDefault()
                        gridRectRef.current = null
                        if (draggingBlockTypeId) {
                          handleDropOnColumn(ds, e.clientY)
                        } else if (draggingBlock) {
                          const snapTime = getTimeFromClientY(e.clientY)
                          const { block, date: fromDate, isDuplicate } = draggingBlock
                          setDraggingBlock(null)
                          setDragOverCol(null)
                          setDragOverTime(null)
                          if (isDuplicate) {
                            duplicateBlock(block, ds, snapTime)
                          } else {
                            moveBlock(block, fromDate, ds, snapTime)
                          }
                        } else if (draggingHopperItem) {
                          handleDropHopperOnColumn(ds, e.clientY)
                        }
                      }}
                    >
                      {/* Hour grid lines */}
                      {Array.from({ length: GRID_HOURS }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            top: i * HOUR_HEIGHT,
                            left: 0,
                            right: 0,
                            height: 1,
                            background: i === 0 ? 'transparent' : '#F0EDE8',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}

                      {/* Current time indicator */}
                      {isToday && (() => {
                        const now = new Date()
                        const nowMin = now.getHours() * 60 + now.getMinutes()
                        if (nowMin < GRID_START * 60 || nowMin > GRID_END * 60) return null
                        const top = (nowMin - GRID_START * 60) * (HOUR_HEIGHT / 60)
                        return (
                          <div style={{
                            position: 'absolute',
                            top,
                            left: 0,
                            right: 0,
                            height: 2,
                            background: '#C4725A',
                            zIndex: 5,
                            pointerEvents: 'none',
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4725A', position: 'absolute', left: -3, top: -2 }} />
                          </div>
                        )
                      })()}

                      {/* Calendar event info bands */}
                      {dayCalEvents
                        .filter(ev => ev.classification?.classification === 'info' || ev.classification === null && false)
                        .filter(ev => ev.classification?.classification === 'info')
                        .map(calEv => {
                          const startT = calEv.start_time.includes('T') ? calEv.start_time.split('T')[1].substring(0, 5) : calEv.start_time.substring(0, 5)
                          const endT = calEv.end_time.includes('T') ? calEv.end_time.split('T')[1].substring(0, 5) : calEv.end_time.substring(0, 5)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                zIndex: 0,
                                top: blockTopPx(startT),
                                height: blockHeightPx(dur),
                                background: '#4B82AF08',
                                borderLeft: '2px solid #4B82AF20',
                                pointerEvents: 'none',
                              }}
                            >
                              <span style={{ fontSize: 8, color: '#4B82AF80', padding: '2px 4px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {calEv.display_label ?? calEv.title}
                              </span>
                            </div>
                          )
                        })
                      }

                      {/* Calendar event provisional */}
                      {dayCalEvents
                        .filter(ev => !ev.classification || ev.classification.classification === 'provisional')
                        .map(calEv => {
                          const startT = calEv.start_time.includes('T') ? calEv.start_time.split('T')[1].substring(0, 5) : calEv.start_time.substring(0, 5)
                          const endT = calEv.end_time.includes('T') ? calEv.end_time.split('T')[1].substring(0, 5) : calEv.end_time.substring(0, 5)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              onClick={() => setClassifying({
                                event: calEv,
                                classification: 'info',
                                displayLabel: calEv.title,
                                energyLevel: 'B',
                                applyToSeries: !!calEv.external_series_id,
                              })}
                              style={{
                                position: 'absolute',
                                left: 2,
                                right: 2,
                                zIndex: 2,
                                cursor: 'pointer',
                                top: blockTopPx(startT),
                                height: blockHeightPx(dur),
                                borderRadius: 6,
                                border: '2px dashed #C4725A60',
                                background: '#C4725A05',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 4,
                                overflow: 'hidden',
                              }}
                            >
                              <span style={{ fontSize: 9, background: '#C4725A', color: 'white', borderRadius: 3, padding: '1px 4px', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>?</span>
                              <span style={{ fontSize: 9, color: '#2D2A26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{calEv.title}</span>
                            </div>
                          )
                        })
                      }

                      {/* Calendar event fixed_commitment — hard block display */}
                      {dayCalEvents
                        .filter(ev => ev.classification?.classification === 'fixed_commitment')
                        .map(calEv => {
                          const startT = calEv.start_time.includes('T') ? calEv.start_time.split('T')[1].substring(0, 5) : calEv.start_time.substring(0, 5)
                          const endT = calEv.end_time.includes('T') ? calEv.end_time.split('T')[1].substring(0, 5) : calEv.end_time.substring(0, 5)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              style={{
                                position: 'absolute',
                                left: 2,
                                right: 2,
                                zIndex: 1,
                                top: blockTopPx(startT),
                                height: blockHeightPx(dur),
                                borderRadius: 6,
                                border: '1.5px solid #9E6A4650',
                                background: '#9E6A4610',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 4,
                                overflow: 'hidden',
                              }}
                            >
                              <span style={{ fontSize: 8, color: '#9E6A46' }}>🔒</span>
                              <span style={{ fontSize: 9, color: '#9E6A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {calEv.display_label ?? calEv.title}
                              </span>
                            </div>
                          )
                        })
                      }

                      {/* Time blocks */}
                      {blocks.map(block => {
                        const isOver = dragOverBlockId === block.id && !block.is_hard
                        const blockColor = block.is_hard ? '#9E6A46' : (block.block_type?.color ?? '#4B82AF')
                        const totalItemMin = block.items.length * 20
                        const fillPct = block.duration_minutes > 0
                          ? Math.min(100, (totalItemMin / block.duration_minutes) * 100)
                          : 0
                        const overFill = totalItemMin > block.duration_minutes

                        return (
                          <div
                            key={block.id}
                            draggable={!block.is_hard}
                            onContextMenu={!block.is_hard ? e => { e.preventDefault(); setDuplicateArmed(prev => prev === block.id ? null : block.id) } : undefined}
                            onDragStart={!block.is_hard ? e => {
                              e.stopPropagation()
                              const isDuplicate = duplicateArmed === block.id
                              setDraggingBlock({ block, date: ds, isDuplicate })
                              setDuplicateArmed(null)
                            } : undefined}
                            onDragEnd={() => { setDraggingBlock(null); setDuplicateArmed(null) }}
                            style={{
                              position: 'absolute',
                              top: blockTopPx(block.start_time),
                              height: blockHeightPx(block.duration_minutes),
                              left: 2,
                              right: 2,
                              borderRadius: 8,
                              background: isOver
                                ? blockColor + '15'
                                : (block.is_hard ? '#9E6A4610' : blockColor + '12'),
                              border: `1.5px solid ${isOver ? blockColor : blockColor + '40'}`,
                              overflow: 'hidden',
                              zIndex: 1,
                              opacity: (draggingBlock?.block.id === block.id && !draggingBlock.isDuplicate) ? 0.4 : 1,
                              cursor: block.is_hard ? 'default' : 'grab',
                              outline: duplicateArmed === block.id ? `2px dashed ${blockColor}` : 'none',
                              outlineOffset: 2,
                            }}
                            onDragOver={!block.is_hard ? e => {
                              e.preventDefault()
                              if (draggingHopperItem) setDragOverBlockId(block.id)
                            } : undefined}
                            onDragLeave={() => { if (dragOverBlockId === block.id) setDragOverBlockId(null) }}
                            onDrop={!block.is_hard ? e => {
                              e.preventDefault()
                              if (draggingHopperItem) {
                                e.stopPropagation()
                                handleDropOnBlock(block, ds)
                              }
                              // draggingBlock drops bubble up to the column
                            } : undefined}
                          >
                            {/* Duplicate-armed indicator */}
                            {duplicateArmed === block.id && (
                              <div style={{
                                position: 'absolute', inset: 0, borderRadius: 8, zIndex: 2,
                                background: blockColor + '10',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none',
                              }}>
                                <span style={{ fontSize: 10, color: blockColor, fontWeight: 700 }}>✦ Drag to duplicate</span>
                              </div>
                            )}

                            {/* Block header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 6px',
                              borderBottom: block.items.length > 0 ? '1px solid #F0EDE8' : 'none',
                            }}>
                              <div style={{ width: 3, height: 14, borderRadius: 2, background: blockColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#2D2A26', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {block.block_type?.icon && <span style={{ marginRight: 3 }}>{block.block_type.icon}</span>}
                                {block.label}
                              </span>
                              <span style={{ fontSize: 9, color: '#8A857D', flexShrink: 0 }}>{formatTime12(block.start_time)}</span>
                              {block.is_hard && <span style={{ fontSize: 8, color: '#9E6A46' }}>🔒</span>}
                              {!block.is_hard && (
                                <button
                                  onClick={() => deleteBlock(block.id, ds)}
                                  style={{
                                    width: 12, height: 12, borderRadius: 3, border: 'none', background: 'transparent',
                                    cursor: 'pointer', fontSize: 9, color: '#8A857D', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', padding: 0, lineHeight: 1, flexShrink: 0,
                                  }}
                                  title="Delete block"
                                >×</button>
                              )}
                            </div>

                            {/* Scheduled items */}
                            {block.items.map(item => (
                              <div
                                key={item.id}
                                style={{
                                  padding: '3px 6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderBottom: '1px solid #F5F3EF',
                                  background: item.status === 'completed' ? '#5A9E6F08' : 'transparent',
                                  borderLeft: item.status === 'completed'
                                    ? '3px solid #5A9E6F'
                                    : item.committed_at
                                      ? `3px solid ${EC[item.time_type]}`
                                      : `3px dashed ${EC[item.time_type]}80`,
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: EC[item.time_type], flexShrink: 0 }} />
                                <span style={{
                                  fontSize: 9,
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: item.status === 'completed' ? '#5A9E6F' : '#2D2A26',
                                  textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                                }}>
                                  {item.name}
                                  {item.emotional_weight === 'heavy' && (
                                    <span style={{ color: '#C4725A', marginLeft: 2, fontSize: 7 }}>◆</span>
                                  )}
                                </span>
                                {item.status !== 'completed' && (
                                  <button
                                    onClick={() => markItemComplete(item, block, ds)}
                                    style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid #8A857D', background: 'transparent', cursor: 'pointer', fontSize: 7, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    title="Mark complete"
                                  >✓</button>
                                )}
                                <button
                                  onClick={() => returnToHopper(item, block, ds)}
                                  style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid #8A857D', background: 'transparent', cursor: 'pointer', fontSize: 7, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                  title="Return to hopper"
                                >←</button>
                              </div>
                            ))}

                            {/* Drop placeholder */}
                            {isOver && draggingHopperItem && (
                              <div style={{ padding: '3px 6px', background: '#4B82AF08', borderBottom: '1px dashed #4B82AF30', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: EC[draggingHopperItem.time_type], flexShrink: 0 }} />
                                <span style={{ fontSize: 9, color: '#4B82AF80', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {draggingHopperItem.name}
                                </span>
                              </div>
                            )}

                            {/* Fill indicator */}
                            {block.items.length > 0 && !block.is_hard && (
                              <div style={{
                                position: 'absolute',
                                bottom: 6,
                                left: 4,
                                right: 4,
                                height: 2,
                                background: '#F0EDE8',
                                borderRadius: 1,
                              }}>
                                <div style={{
                                  width: `${fillPct}%`,
                                  height: '100%',
                                  background: overFill ? '#D4564E' : '#5A9E6F',
                                  borderRadius: 1,
                                }} />
                              </div>
                            )}

                            {/* Resize handle */}
                            {!block.is_hard && (
                              <div
                                onMouseDown={e => startResize(e, block, ds)}
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: 6,
                                  cursor: 'ns-resize',
                                  background: 'transparent',
                                }}
                              />
                            )}
                          </div>
                        )
                      })}

                      {/* Drag-over placeholder from palette or block move */}
                      {showPlaceholder && dragOverTime && (
                        <div
                          style={{
                            position: 'absolute',
                            top: blockTopPx(dragOverTime),
                            height: blockHeightPx(placeholderDuration),
                            left: 2,
                            right: 2,
                            borderRadius: 8,
                            background: placeholderColor + '20',
                            border: `2px dashed ${placeholderColor}60`,
                            zIndex: 10,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: 9, color: placeholderColor, fontWeight: 600 }}>
                            {draggingBlock
                              ? `${draggingBlock.block.block_type?.icon ?? ''} ${draggingBlock.block.label} ${formatTime12(dragOverTime)}`
                              : `${placeholderBt?.icon ?? ''} ${placeholderBt?.name ?? ''} ${formatTime12(dragOverTime)}`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Summary Panel ─────────────────────────────────────────────── */}
          {summaryShrunk ? (
            <div
              onClick={() => setSummaryShrunk(false)}
              style={{
                width: 40,
                borderLeft: '1px solid #E8E4DC',
                background: '#F7F5F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 9, color: '#8A857D', writingMode: 'vertical-rl', letterSpacing: 1 }}>SUMMARY</span>
            </div>
          ) : (
            <div style={{
              width: 220,
              borderLeft: '1px solid #E8E4DC',
              background: '#F7F5F0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {/* Summary tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E8E4DC', flexShrink: 0 }}>
                {(['summary', 'completed'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    style={{
                      flex: 1,
                      padding: '9px 4px',
                      border: 'none',
                      background: rightTab === tab ? '#FAFAF7' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: rightTab === tab ? 600 : 400,
                      color: rightTab === tab ? '#2D2A26' : '#8A857D',
                      borderBottom: rightTab === tab ? '2px solid #2D2A26' : '2px solid transparent',
                    }}
                  >
                    {tab === 'summary' ? 'Week View' : `Done ✓${completedItems.length > 0 ? ` (${completedItems.length})` : ''}`}
                  </button>
                ))}
                <button
                  onClick={() => setSummaryShrunk(true)}
                  style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#B5B0A8' }}
                >▶</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {rightTab === 'summary' ? (
                  <>
                    {/* Time Balance */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#5A5650', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Time Balance</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {(['A', 'B', 'C', 'D', '0'] as const).map(level => (
                          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 20, height: 20, borderRadius: '50%', background: EC[level], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: level === '0' ? '#5A5650' : '#FFF', fontWeight: 700, flexShrink: 0 }}>
                              {level}
                            </span>
                            <span style={{ fontSize: 9, color: '#8A857D', minWidth: 48 }}>{EL[level]}</span>
                            <div style={{ flex: 1, height: 6, background: '#E8E4DC', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${allScheduledItems.length > 0 ? ((energyCounts[level] ?? 0) / allScheduledItems.length) * 100 : 0}%`,
                                background: EC[level],
                                borderRadius: 3,
                              }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#8A857D', minWidth: 16, textAlign: 'right' }}>{energyCounts[level] ?? 0}</span>
                          </div>
                        ))}
                      </div>
                      {/* Warnings */}
                      {allScheduledItems.length > 0 && (() => {
                        const warnings: string[] = []
                        if ((energyCounts['0'] ?? 0) === 0) warnings.push('No free time this week. Consider protecting some.')
                        if ((energyCounts['D'] ?? 0) === 0) warnings.push('No self-care scheduled. This creates a leak in your Safety pool.')
                        // Check if any day has 3+ C-type items
                        const cByDay: Record<string, number> = {}
                        Object.entries(dayBlocks).forEach(([ds, blocks]) => {
                          blocks.forEach(b => b.items.forEach(item => {
                            if (item.time_type === 'C') cByDay[ds] = (cByDay[ds] ?? 0) + 1
                          }))
                        })
                        const heavyCDay = Object.entries(cByDay).find(([, count]) => count >= 3)
                        if (heavyCDay) {
                          const dayName = new Date(heavyCDay[0]).toLocaleDateString('en-US', { weekday: 'short' })
                          warnings.push(`${dayName} has ${heavyCDay[1]} unwanted obligations clustered. Consider spreading them.`)
                        }
                        if (warnings.length === 0) return null
                        return (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {warnings.map((w, i) => (
                              <div key={i} style={{ fontSize: 9, color: '#9E6A46', background: '#FFF8F0', border: '1px solid #F5E4D0', borderRadius: 4, padding: '4px 6px', lineHeight: 1.4 }}>
                                {w}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Items per day */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#5A5650', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Items Per Day</div>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
                        {dayItemCounts.map((count, i) => {
                          const ds = dateStr(weekDates[i])
                          const isToday = ds === today
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{
                                width: '100%',
                                height: count === 0 ? 2 : Math.max(4, (count / maxDayCount) * 32),
                                background: isToday ? '#C4725A' : '#D0CBC3',
                                borderRadius: 2,
                              }} />
                              <span style={{ fontSize: 8, color: isToday ? '#C4725A' : '#B5B0A8' }}>{DAY_LABELS[i].charAt(0)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Hopper remaining */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#5A5650', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Hopper Remaining</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: hopper.length > 5 ? '#C4725A' : '#2D2A26' }}>{hopper.length}</span>
                        <div style={{ fontSize: 10, color: '#8A857D', lineHeight: 1.3 }}>
                          {urgentHopper.length > 0 && <div style={{ color: '#C4725A' }}>{urgentHopper.length} urgent</div>}
                          <div>{normalHopper.length} to do</div>
                          {suggestedHopper.length > 0 && <div style={{ color: '#B5B0A8' }}>{suggestedHopper.length} suggested</div>}
                        </div>
                      </div>
                    </div>

                    {/* Total blocks placed */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#5A5650', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>Blocks Placed</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {weekDates.map((d, i) => {
                          const ds = dateStr(d)
                          const count = (dayBlocks[ds] ?? []).length
                          return (
                            <div key={i} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: '#B5B0A8' }}>{DAY_LABELS[i].charAt(0)}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: count > 0 ? '#2D2A26' : '#D0CBC3' }}>{count}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  // Done tab
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#5A9E6F', marginBottom: 10 }}>
                      {completedItems.length} completed
                    </div>
                    {completedItems.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#B5B0A8', textAlign: 'center', paddingTop: 16 }}>
                        Nothing completed yet
                      </div>
                    ) : (
                      weekDates.map(d => {
                        const ds = dateStr(d)
                        const dayCompleted = completedByDay[ds]
                        if (!dayCompleted?.length) return null
                        return (
                          <div key={ds} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', marginBottom: 4 }}>
                              {DAY_LABELS[weekDates.indexOf(d)]} {d.getDate()}
                            </div>
                            {dayCompleted.map(({ item, blockLabel }) => (
                              <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, paddingLeft: 4 }}>
                                <span style={{ color: '#5A9E6F', fontSize: 10, marginTop: 1, flexShrink: 0 }}>✓</span>
                                <div>
                                  <div style={{ fontSize: 10, color: '#2D2A26', textDecoration: 'line-through', lineHeight: 1.3 }}>{item.name}</div>
                                  <div style={{ fontSize: 9, color: '#B5B0A8' }}>{blockLabel}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Classification Popover ──────────────────────────────────────────── */}
      {classifying && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(45,42,38,0.15)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setClassifying(null) }}
        >
          <div style={{
            background: '#FAFAF7',
            borderRadius: 14,
            padding: 24,
            width: 340,
            boxShadow: '0 8px 32px rgba(45,42,38,0.18)',
            fontFamily: '"Source Sans 3", sans-serif',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2A26', marginBottom: 4 }}>
              Classify Event
            </div>
            <div style={{ fontSize: 13, color: '#5A5650', marginBottom: 16, background: '#F0EDE8', borderRadius: 8, padding: '6px 10px' }}>
              {classifying.event.title}
            </div>

            {/* Classification radio */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['info', 'fixed_commitment', 'flexible_commitment'] as const).map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#2D2A26' }}>
                    <input
                      type="radio"
                      name="classify"
                      value={opt}
                      checked={classifying.classification === opt}
                      onChange={() => setClassifying(s => s ? { ...s, classification: opt } : s)}
                    />
                    {opt === 'info' ? 'Info only (background)' : opt === 'fixed_commitment' ? 'Fixed commitment (hard block)' : 'Flexible commitment (add to hopper)'}
                  </label>
                ))}
              </div>
            </div>

            {/* Display label */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Display Label</div>
              <input
                value={classifying.displayLabel}
                onChange={e => setClassifying(s => s ? { ...s, displayLabel: e.target.value } : s)}
                style={{ width: '100%', fontSize: 13, border: '1px solid #E0DDD6', borderRadius: 8, padding: '7px 10px', background: '#FFF', color: '#2D2A26', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {/* Energy level (for commitments) */}
            {classifying.classification !== 'info' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Energy Level</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['A', 'B', 'C', 'D', '0'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setClassifying(s => s ? { ...s, energyLevel: level } : s)}
                      style={{
                        flex: 1, padding: '5px', borderRadius: 8,
                        border: `1.5px solid ${classifying.energyLevel === level ? EC[level] : '#E0DDD6'}`,
                        background: classifying.energyLevel === level ? EC[level] + '15' : '#FFF',
                        cursor: 'pointer', fontSize: 11, fontWeight: 500,
                        color: classifying.energyLevel === level ? EC[level] : '#8A857D',
                      }}
                    >
                      {level} {EL[level]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Apply to series */}
            {classifying.event.external_series_id && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#5A5650' }}>
                  <input
                    type="checkbox"
                    checked={classifying.applyToSeries}
                    onChange={e => setClassifying(s => s ? { ...s, applyToSeries: e.target.checked } : s)}
                  />
                  Apply to all instances of this recurring event
                </label>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setClassifying(null)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#5A5650' }}
              >Cancel</button>
              <button
                onClick={saveClassification}
                style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#2D2A26', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#FFF' }}
              >Save Classification</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hopper Item Edit Modal ───────────────────────────────────────────── */}
      {editingHopperId && (() => {
        const item = hopper.find(h => h.id === editingHopperId)
        if (!item) return null
        const enrichData = buildEditEnrichment(item)
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1002,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(45,42,38,0.30)',
            }}
            onClick={e => { if (e.target === e.currentTarget) setEditingHopperId(null) }}
          >
            <div style={{ maxWidth: 400, width: '90vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 12 }}>
              <EnrichmentCard
                hopperItemId={item.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                enrichmentData={enrichData as any}
                domains={(domains ?? []).map(d => ({ id: d.id, name: d.name }))}
                values={(values ?? []).map(v => ({ id: v.id, name: v.name }))}
                outcomes={[]}
                blockTypes={blockTypes.map(bt => ({ id: bt.id, name: bt.name }))}
                defaultExpanded
                onConfirm={(id, ed) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const data = ed as any
                  handleEnrichmentConfirm(id, data)
                  setHopper(prev => prev.map(h => h.id === id ? {
                    ...h,
                    name: data.suggested_name ?? h.name,
                    time_type: data.suggested_time_type ?? h.time_type,
                    emotional_weight: data.suggested_emotional_weight ?? h.emotional_weight,
                    duration_min: data.suggested_duration_min ?? h.duration_min,
                    duration_max: data.suggested_duration_max ?? h.duration_max,
                    enrichment_data: data,
                    enrichment_status: 'confirmed' as const,
                  } : h))
                  setEditingHopperId(null)
                }}
                onDecline={() => setEditingHopperId(null)}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  template_proposal: '#7A9E82',
  outside_request: '#C4725A',
  quick_capture: '#4B82AF',
  planning_function: '#9E6A82',
}

interface HopperItemCardProps {
  item: HopperItemLocal
  onDismiss: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onEnrich?: () => void
  dragging: boolean
  armed?: boolean
  muted?: boolean
}

const HopperItemCard = memo(function HopperItemCard({ item, onDismiss, onDragStart, onDragEnd, onContextMenu, onDoubleClick, onEnrich, dragging, armed, muted }: HopperItemCardProps) {
  const borderColor: Record<string, string> = { urgent: '#C4725A40', normal: '#E8E4DC', suggested: '#F0EDE8' }
  const leftBorderColor: Record<string, string> = { urgent: '#C4725A', normal: '#D0CBC3', suggested: '#E8E4DC' }
  const bgColor: Record<string, string> = { urgent: '#FDF8F5', normal: '#FFFFFF', suggested: '#F9F7F4' }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '6px 8px',
        marginBottom: 4,
        borderRadius: 8,
        border: armed ? '1.5px dashed #4B82AF' : `1px solid ${borderColor[item.priority_tier]}`,
        borderLeft: armed ? '3px dashed #4B82AF' : `3px solid ${leftBorderColor[item.priority_tier]}`,
        background: armed ? '#4B82AF08' : bgColor[item.priority_tier],
        cursor: 'grab',
        opacity: dragging ? 0.4 : muted ? 0.7 : 1,
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {armed && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          fontSize: 8, color: '#4B82AF', fontWeight: 700, lineHeight: 1,
        }}>✦ drag to place</div>
      )}
      {/* Energy dot */}
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: EC[item.time_type],
        flexShrink: 0,
        marginTop: 3,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: item.priority_tier === 'urgent' ? 600 : 400,
          color: TIER_COLORS[item.priority_tier],
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}>
          {item.enrichment_status === 'pending' && (
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#C4725A', marginRight: 5, animation: 'ws-pulse 1s infinite', verticalAlign: 'middle' }} />
          )}
          {item.enrichment_status === 'enriched' && (
            <span style={{ fontSize: 8, color: '#BA7517', marginRight: 4 }}>✦</span>
          )}
          {item.name}
          {item.emotional_weight === 'heavy' && (
            <span style={{ color: '#C4725A', marginLeft: 3, fontSize: 8 }}>◆</span>
          )}
        </div>
        {item.enrichment_status === 'none' && onEnrich && (
          <button
            onClick={e => { e.stopPropagation(); onEnrich() }}
            style={{ fontSize: 9, color: '#BA7517', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: 2 }}
          >✦ Enrich</button>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 8,
            background: (SOURCE_COLORS[item.source] ?? '#8A857D') + '15',
            color: SOURCE_COLORS[item.source] ?? '#8A857D',
            borderRadius: 4,
            padding: '1px 4px',
            fontWeight: 500,
          }}>
            {SOURCE_ICONS[item.source] ?? '○'} {SOURCE_LABELS[item.source] ?? item.source}
          </span>
          {item.duration_min > 0 && (
            <span style={{ fontSize: 8, color: '#B5B0A8' }}>
              {item.duration_min === item.duration_max
                ? `${item.duration_min}m`
                : `${item.duration_min}–${item.duration_max}m`}
            </span>
          )}
          {item.meta?.requestedBy && (
            <span style={{ fontSize: 8, color: '#8A857D', fontStyle: 'italic' }}>
              by {item.meta.requestedBy}
            </span>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 10,
          color: '#D0CBC3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          lineHeight: 1,
          marginTop: 1,
        }}
        title="Dismiss"
      >×</button>
    </div>
  )
})

// Inject pulse animation globally once
if (typeof document !== 'undefined' && !document.getElementById('ws-pulse-style')) {
  const style = document.createElement('style')
  style.id = 'ws-pulse-style'
  style.textContent = '@keyframes ws-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }'
  document.head.appendChild(style)
}
