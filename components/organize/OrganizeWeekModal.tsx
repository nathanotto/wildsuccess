'use client'
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { UserValue, LifeDomain, Activity } from '@/lib/types'
import EditActivityModal from '@/components/map/EditActivityModal'

const CADENCE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, annual: 365,
}

interface ActivityLocal {
  id: string
  name: string
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  frequency: string | null
  duration_range_min: number | null
  duration_range_max: number | null
  preferred_time: string | null
}

// ── Design constants ──────────────────────────────────────────────────────────
const HOUR_HEIGHT = 44
const GRID_START = 5
const GRID_END = 22
const GRID_HOURS = GRID_END - GRID_START
const GRID_HEIGHT = GRID_HOURS * HOUR_HEIGHT

const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Connection', D: 'Restore', '0': 'Open' }
const TIER_COLORS: Record<string, string> = { urgent: '#C4725A', normal: '#2D2A26', suggested: '#2D2A26' }

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
  items: ActionItemLocal[]
}

interface ActionItemLocal {
  id: string
  name: string
  activity_id?: string | null
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  status: 'committed' | 'completed' | 'skipped'
  committed_at?: string | null
  metadata?: Record<string, unknown> | null
}

interface CandidateItemLocal {
  id: string
  name: string
  source: 'quick_capture' | 'template_proposal' | 'outside_request' | 'planning_function' | string
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  priority_tier: 'urgent' | 'normal' | 'suggested'
  priority_score: number
  block_type_hint: string | null
  duration_min: number
  duration_max: number
  values: string[]
  activity_id: string | null
  big_outcome_id?: string | null
  preferred_time: string | null
  frequency: string | null
  meta?: { requestedBy?: string }
}

interface FloatingActionItem {
  id: string
  committed_date: string
  scheduled_time: string
  scheduled_end_time: string | null
  name: string
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  status: 'committed' | 'completed' | 'skipped'
  activity_id: string | null
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
    classification: 'provisional' | 'info' | 'fixed_commitment' | 'flexible_commitment' | 'hidden'
    display_label: string | null
  } | null
}

interface DaySpanLocal {
  id: string
  name: string
  start_date: string
  end_date: string
  person_id: string | null
  person?: { id: string; name: string } | null
  note: string | null
  color: string | null
  value_links: { id: string; value_id: string; contribution_strength: 'weak' | 'moderate' | 'strong' }[]
}

interface KnownPersonLocal {
  id: string
  name: string
}

const SPAN_COLORS = ['#E8E4DC', '#C4725A', '#4B6A82', '#7A6BAF', '#5A9E6F', '#B8896E', '#8A857D', '#BA7517']
const DEFAULT_SPAN_COLOR = '#E8E4DC'

interface ClassifyState {
  event: CalEventLocal
  classification: 'info' | 'fixed_commitment' | 'flexible_commitment'
  displayLabel: string
  energyLevel: 'A' | 'B' | 'C' | 'D' | '0'
  applyToSeries: boolean
  hiding?: boolean
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onClose?: () => void
  values: UserValue[]
  domains: LifeDomain[]
  activities?: Activity[]
  mode?: 'modal' | 'page'
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr(): string {
  return dateStr(new Date())
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
function localTimeStr(isoOrHHMM: string): string {
  // If it's a full ISO timestamp, extract local HH:MM; otherwise pass through
  if (!isoOrHHMM.includes('-') && !isoOrHHMM.includes('+') && isoOrHHMM.length <= 5) return isoOrHHMM
  const d = new Date(isoOrHHMM)
  if (isNaN(d.getTime())) return isoOrHHMM.substring(0, 5)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
/** Get current hours:minutes in a specific IANA timezone */
function nowInTz(tz: string): { hours: number; minutes: number; dateStr: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return { hours, minutes, dateStr }
}

export default function OrganizeWeekModal({ onClose, values, domains, mode = 'page' }: Props) {
  const isPage = mode === 'page'
  // Core state
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [outcomes, setOutcomes] = useState<{ id: string; name: string; status: string; completed_at: string | null }[]>([])
  const [thisWeekRecord, setThisWeekRecord] = useState<{ create_statement?: string | null; completed_at_ritual?: string | null; created_at_ritual?: string | null; organized_at?: string | null; deconflicted_at?: string | null } | null>(null)
  const [focusMinutes, setFocusMinutes] = useState(50)
  const [dayBlocks, setDayBlocks] = useState<Record<string, TimeBlockLocal[]>>({})
  const [hopper, setHopper] = useState<CandidateItemLocal[]>([])
  const [carriedOverItems, setCarriedOverItems] = useState<{ id: string; name: string; status: string; committed_date: string; time_type: 'A' | 'B' | 'C' | 'D' | '0'; emotional_weight: 'light' | 'normal' | 'heavy' }[]>([])
  const [floatingItems, setFloatingItems] = useState<Record<string, FloatingActionItem[]>>({})
  const [calEvents, setCalEvents] = useState<CalEventLocal[]>([])
  const [calConnected, setCalConnected] = useState(false)
  const [daySpans, setDaySpans] = useState<DaySpanLocal[]>([])
  const [knownPeople, setKnownPeople] = useState<KnownPersonLocal[]>([])
  const [editingSpan, setEditingSpan] = useState<DaySpanLocal | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [userTz, setUserTz] = useState<string | null>(null)
  const [nowMinutes, setNowMinutes] = useState<number | null>(null) // minutes since midnight in WS timezone
  const [tzTodayStr, setTzTodayStr] = useState<string | null>(null) // today in WS timezone

  // Inline block label edit
  const [editingBlockLabel, setEditingBlockLabel] = useState<{ blockId: string; date: string; label: string } | null>(null)

  // UI state
  const [paletteShrunk, setPaletteShrunk] = useState(false)
  const [hopperShrunk, setHopperShrunk] = useState(false)
  const [summaryShrunk, setSummaryShrunk] = useState(false)
  const [hopperFilter, setHopperFilter] = useState('all')
  const [rightTab, setRightTab] = useState<'summary' | 'completed'>('summary')
  const [classifying, setClassifying] = useState<ClassifyState | null>(null)
  const [showBlockTypeEditor, setShowBlockTypeEditor] = useState(false)
  const [nudgingOutcomeId, setNudgingOutcomeId] = useState<string | null>(null)
  const [nudgeInput, setNudgeInput] = useState('')

  // Drag state
  const [draggingBlockTypeId, setDraggingBlockTypeId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [dragOverTime, setDragOverTime] = useState<string | null>(null)
  const [draggingHopperItem, setDraggingHopperItem] = useState<CandidateItemLocal | null>(null)
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
  const dragOffsetYRef = useRef(0) // Y offset of cursor within the dragged block

  // Hopper item persist-drag (right-click to keep item in hopper after placing)
  const [hopperDuplicateArmed, setHopperDuplicateArmed] = useState<string | null>(null)

  // Capture
  const [captureInput, setCaptureInput] = useState('')
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    itemId: string; name: string; date: string; time: string; endTime?: string | null
  } | null>(null)

  // Activity editor (double-click on hopper item, or "Make Activity" on capture)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null) // UUID or 'new'
  const [editingActivityPrefillName, setEditingActivityPrefillName] = useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingActivityFull, setEditingActivityFull] = useState<any | null>(null)

  async function openActivityEditor(activityId: string) {
    const res = await fetch(`/api/activities/${activityId}`)
    if (res.ok) {
      const data = await res.json()
      setEditingActivityFull(data)
    }
    setEditingActivityId(activityId)
  }

  // Block type editor state
  const [editingBlockTypes, setEditingBlockTypes] = useState<BlockType[]>([])

  // Auto-place highlight
  const [newlyPlacedIds, setNewlyPlacedIds] = useState<Set<string>>(new Set())

  // Animation state
  const [exitingHopperIds, setExitingHopperIds] = useState<Set<string>>(new Set())
  const [exitingBlockIds, setExitingBlockIds] = useState<Set<string>>(new Set())
  const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set())
  const [returningHopperIds, setReturningHopperIds] = useState<Set<string>>(new Set())

  // Activities + schedule coverage for dynamic Suggested computation
  const [activities, setActivities] = useState<ActivityLocal[]>([])
  const [scheduleCoverage, setScheduleCoverage] = useState<{ activity_id: string; scheduled_date: string }[]>([])
  const [dismissedVirtualIds, setDismissedVirtualIds] = useState<Set<string>>(new Set())
  // DB-backed week dismissals: { id: action_item_id, activity_id, name, time_type, preferred_time }
  const [weekDismissed, setWeekDismissed] = useState<CandidateItemLocal[]>([])

  // Block hover tooltip
  const [blockTooltip, setBlockTooltip] = useState<{ label: string; time: string; x: number; y: number } | null>(null)

  // Refs
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const dragRafRef = useRef<number | null>(null)     // RAF handle for throttled drag-over
  const gridRectRef = useRef<DOMRect | null>(null)   // cached bounding rect during drag
  const dayBlocksRef = useRef(dayBlocks)             // stable ref for resize effect
  dayBlocksRef.current = dayBlocks                   // keep in sync without triggering effects

  // ── Timezone-aware clock ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      const tz = data?.timezone ?? 'America/Denver'
      setUserTz(tz)
      const n = nowInTz(tz)
      setNowMinutes(n.hours * 60 + n.minutes)
      setTzTodayStr(n.dateStr)
    })
  }, [])

  useEffect(() => {
    if (!userTz) return
    const interval = setInterval(() => {
      const n = nowInTz(userTz)
      setNowMinutes(n.hours * 60 + n.minutes)
      setTzTodayStr(n.dateStr)
    }, 60000)
    return () => clearInterval(interval)
  }, [userTz])

  // ── Data loading ────────────────────────────────────────────────────────────
  const lastProposedWeekRef = useRef<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const rangeStartForPropose = dateStr(weekStart)

      // Seed block types once per week (idempotent)
      if (lastProposedWeekRef.current !== rangeStartForPropose) {
        lastProposedWeekRef.current = rangeStartForPropose
        await fetch('/api/block-types/seed-defaults', { method: 'POST' })
      }

      const rangeStart = rangeStartForPropose
      const rangeEnd = dateStr(addDays(weekStart, 6))

      const [
        btRes,
        tbRes,
        siRes,
        hopperRes,
        dismissedRes,
        calRes,
        calSettingsRes,
        outcomesRes,
        activitiesRes,
        coverageRes,
        spansRes,
        peopleRes,
        carriedRes,
      ] = await Promise.all([
        fetch('/api/block-types'),
        fetch(`/api/time-blocks?range_start=${rangeStart}&range_end=${rangeEnd}`),
        fetch(`/api/action-items?range_start=${rangeStart}&range_end=${rangeEnd}`),
        fetch(`/api/action-items?status=candidate&through_date=${rangeEnd}`),
        fetch(`/api/action-items?status=dismissed`),
        fetch(`/api/calendar/events?start=${rangeStart}T00:00:00Z&end=${rangeEnd}T23:59:59Z`),
        fetch('/api/calendar/settings'),
        fetch('/api/big-outcomes'),
        fetch('/api/activities'),
        fetch('/api/action-items/coverage'),
        fetch(`/api/day-spans?week_start=${rangeStart}&week_end=${rangeEnd}`),
        fetch('/api/known-people'),
        fetch(`/api/action-items?rolled_over=true&week_start=${rangeStart}`),
      ])

      const [btData, tbData, siData, hopperData, dismissedData, calData, calSettings, outcomesData, activitiesData, coverageData, spansData, peopleData, carriedData] = await Promise.all([
        btRes.ok ? btRes.json() : [],
        tbRes.ok ? tbRes.json() : [],
        siRes.ok ? siRes.json() : [],
        hopperRes.ok ? hopperRes.json() : [],
        dismissedRes.ok ? dismissedRes.json() : [],
        calRes.ok ? calRes.json() : [],
        calSettingsRes.ok ? calSettingsRes.json() : { connected: false },
        outcomesRes.ok ? outcomesRes.json() : [],
        activitiesRes.ok ? activitiesRes.json() : [],
        coverageRes.ok ? coverageRes.json() : [],
        spansRes.ok ? spansRes.json() : [],
        peopleRes.ok ? peopleRes.json() : [],
        carriedRes.ok ? carriedRes.json() : [],
      ])

      const bts: BlockType[] = Array.isArray(btData) ? btData : []
      setBlockTypes(bts)

      // Day spans
      setDaySpans(Array.isArray(spansData) ? spansData : [])
      setKnownPeople(Array.isArray(peopleData) ? peopleData : [])
      setEditingBlockTypes(bts)

      const outcomesArr: { id: string; name: string; status: string; completed_at: string | null }[] = Array.isArray(outcomesData) ? outcomesData : []
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      setOutcomes(outcomesArr.filter(o =>
        o.status === 'aspirational' || o.status === 'in_progress' ||
        (o.completed_at && o.completed_at >= sevenDaysAgo)
      ).map(o => ({ id: o.id, name: o.name, status: o.status, completed_at: o.completed_at ?? null })))

      // Build dayBlocks from time_blocks + action_items
      const blocks: TimeBlockLocal[] = Array.isArray(tbData) ? tbData : []
      const schedItems: Array<{
        id: string
        time_block_id?: string | null
        committed_date: string
        scheduled_time?: string | null
        scheduled_end_time?: string | null
        name: string
        activity_id?: string | null
        time_type: 'A' | 'B' | 'C' | 'D' | '0'
        emotional_weight: 'light' | 'normal' | 'heavy'
        status: 'committed' | 'completed' | 'skipped'
        committed_at?: string | null
      }> = Array.isArray(siData) ? siData : []

      const newDayBlocks: Record<string, TimeBlockLocal[]> = {}
      for (const block of blocks) {
        const ds = block.block_date
        if (!newDayBlocks[ds]) newDayBlocks[ds] = []

        const blockItems: ActionItemLocal[] = schedItems
          .filter(si => si.time_block_id === block.id)
          .map(si => ({
            id: si.id,
            name: si.name,
            activity_id: si.activity_id ?? null,
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

      // Extract floating schedule items (no time_block_id, have scheduled_time)
      const newFloating: Record<string, FloatingActionItem[]> = {}
      for (const si of schedItems) {
        if (si.time_block_id || !si.scheduled_time) continue
        const ds = si.committed_date
        if (!newFloating[ds]) newFloating[ds] = []
        newFloating[ds].push({
          id: si.id,
          committed_date: si.committed_date,
          scheduled_time: si.scheduled_time,
          scheduled_end_time: si.scheduled_end_time ?? null,
          name: si.name,
          time_type: si.time_type,
          status: si.status,
          activity_id: si.activity_id ?? null,
        })
      }
      setFloatingItems(newFloating)

      // Build hopper (candidate action items)
      const rawHopper: Array<{
        id: string
        name: string
        source: string
        status: string
        activity_id?: string | null
        activity?: {
          time_type?: 'A' | 'B' | 'C' | 'D' | '0'
          emotional_weight?: 'light' | 'normal' | 'heavy'
          duration_range_min?: number | null
          duration_range_max?: number | null
          preferred_time?: string | null
          preferred_days?: string[] | null
          frequency?: string | null
        } | null
        metadata?: Record<string, unknown> | null
        priority_tier?: string
        priority_score?: number
        enrichment_status?: string
        enrichment_data?: Record<string, unknown> | null
        big_outcome_id?: string | null
      }> = Array.isArray(hopperData) ? hopperData : []

      const hopperItems: CandidateItemLocal[] = rawHopper
        // Exclude template_proposal items — Suggested is now computed dynamically from activities
        .filter(h => h.status === 'candidate' && h.source !== 'template_proposal')
        .map(h => ({
          id: h.id,
          name: h.name,
          source: h.source,
          time_type: (h.activity?.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
          emotional_weight: (h.activity?.emotional_weight ?? 'normal') as 'light' | 'normal' | 'heavy',
          priority_tier: (h.priority_tier ?? 'normal') as 'urgent' | 'normal' | 'suggested',
          priority_score: h.priority_score ?? 50,
          block_type_hint: null,
          duration_min: h.activity?.duration_range_min ?? 20,
          duration_max: h.activity?.duration_range_max ?? 60,
          values: [],
          activity_id: h.activity_id ?? null,
          big_outcome_id: h.big_outcome_id ?? null,
          preferred_time: h.activity?.preferred_time ?? null,
          frequency: h.activity?.frequency ?? null,
          meta: h.metadata as { requestedBy?: string } | undefined,
        }))
      // Deduplicate by id — should never be needed but prevents key collisions if state gets polluted
      const seen = new Set<string>()
      setHopper(hopperItems.filter(h => seen.has(h.id) ? false : (seen.add(h.id), true)))

      // Carried-over items: committed/in_progress items from before this week
      const rawCarried: Array<{ id: string; name: string; status: string; committed_date: string; time_type?: string; emotional_weight?: string }> = Array.isArray(carriedData) ? carriedData : []
      setCarriedOverItems(rawCarried.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        committed_date: c.committed_date,
        time_type: (c.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
        emotional_weight: (c.emotional_weight ?? 'normal') as 'light' | 'normal' | 'heavy',
      })))

      // Week-dismissed suggested items: template_proposal dismissed items whose metadata.dismissed_week === rangeStart
      const rawDismissed: Array<{
        id: string
        name: string
        activity_id?: string | null
        metadata?: { dismissed_week?: string } | null
        activity?: {
          time_type?: 'A' | 'B' | 'C' | 'D' | '0'
          preferred_time?: string | null
          duration_range_min?: number | null
          duration_range_max?: number | null
          frequency?: string | null
        } | null
      }> = Array.isArray(dismissedData) ? dismissedData : []

      const dismissedThisWeek = rawDismissed.filter(
        h => h.metadata?.dismissed_week === rangeStart && h.activity_id
      )
      setWeekDismissed(dismissedThisWeek.map(h => ({
        id: h.id,
        name: h.name,
        source: 'template_proposal' as const,
        time_type: (h.activity?.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
        emotional_weight: 'normal' as const,
        priority_tier: 'suggested' as const,
        priority_score: 0,
        block_type_hint: null,
        duration_min: h.activity?.duration_range_min ?? 20,
        duration_max: h.activity?.duration_range_max ?? 60,
        values: [],
        activity_id: h.activity_id!,
        preferred_time: h.activity?.preferred_time ?? null,
        frequency: h.activity?.frequency ?? null,
      })))
      // Also set the in-memory dismissed set so suggestedHopper excludes them immediately
      setDismissedVirtualIds(new Set(dismissedThisWeek.map(h => h.activity_id!)))

      // Activities for dynamic Suggested computation
      if (Array.isArray(activitiesData)) {
        setActivities(activitiesData
          .filter((a: ActivityLocal & { status?: string }) => a.status === 'active' && a.frequency && CADENCE_DAYS[a.frequency])
          .map((a: ActivityLocal) => ({
            id: a.id, name: a.name, time_type: a.time_type, emotional_weight: a.emotional_weight,
            frequency: a.frequency, duration_range_min: a.duration_range_min,
            duration_range_max: a.duration_range_max, preferred_time: a.preferred_time,
          }))
        )
      }
      if (Array.isArray(coverageData)) setScheduleCoverage(coverageData)

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
      // Fetch week record for C&C link
      fetch(`/api/weeks/${dateStr(weekStart)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(w => setThisWeekRecord(w))

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
      const rawDelta = Math.round((dy / HOUR_HEIGHT) * 60 / 5) * 5
      const newEndMin = Math.max(
        resizing.initialStartMin + 5,
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
      const rawDelta = Math.round((dy / HOUR_HEIGHT) * 60 / 5) * 5
      const newEndMin = Math.min(GRID_END * 60, Math.max(resizing.initialStartMin + 5, resizing.initialEndMin + rawDelta))
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
    return Math.max(4, durationMin * (HOUR_HEIGHT / 60))
  }

  // Compute overlap columns for blocks that share time ranges (Google Calendar style)
  function computeOverlapLayout(blocks: Array<{ id: string; start_time: string; duration_minutes: number }>) {
    if (blocks.length === 0) return new Map<string, { col: number; totalCols: number }>()

    // Sort by start time, then by duration (longer first)
    const sorted = [...blocks].sort((a, b) => {
      const d = timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      return d !== 0 ? d : b.duration_minutes - a.duration_minutes
    })

    const endTime = (b: { start_time: string; duration_minutes: number }) =>
      timeToMinutes(b.start_time) + b.duration_minutes

    // Group overlapping blocks into clusters
    const clusters: Array<typeof sorted> = []
    let current: typeof sorted = []
    let clusterEnd = 0

    for (const block of sorted) {
      const start = timeToMinutes(block.start_time)
      if (current.length === 0 || start < clusterEnd) {
        current.push(block)
        clusterEnd = Math.max(clusterEnd, endTime(block))
      } else {
        clusters.push(current)
        current = [block]
        clusterEnd = endTime(block)
      }
    }
    if (current.length > 0) clusters.push(current)

    // Assign columns within each cluster
    const layout = new Map<string, { col: number; totalCols: number }>()
    for (const cluster of clusters) {
      const columns: Array<number> = [] // end time of last block in each column
      const assignments: Array<{ id: string; col: number }> = []

      for (const block of cluster) {
        const start = timeToMinutes(block.start_time)
        let placed = false
        for (let c = 0; c < columns.length; c++) {
          if (columns[c] <= start) {
            columns[c] = endTime(block)
            assignments.push({ id: block.id, col: c })
            placed = true
            break
          }
        }
        if (!placed) {
          assignments.push({ id: block.id, col: columns.length })
          columns.push(endTime(block))
        }
      }

      const totalCols = columns.length
      for (const a of assignments) {
        layout.set(a.id, { col: a.col, totalCols })
      }
    }

    return layout
  }

  // ── Block placement ─────────────────────────────────────────────────────────
  async function handleDropOnColumn(ds: string, clientY: number) {
    if (!draggingBlockTypeId) return
    const blockType = blockTypes.find(bt => bt.id === draggingBlockTypeId)
    if (!blockType) return

    const snapTime = getTimeFromClientY(clientY)
    const duration = blockType.name === 'Desk' ? focusMinutes : blockType.default_duration_minutes
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

      // Auto-create a committed action_item linked to this block
      let blockItem: ActionItemLocal | null = null
      const aiRes = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: blockType.name,
          committed_date: ds,
          time_block_id: newBlock.id,
          scheduled_time: snapTime,
          scheduled_end_time: endTime,
          time_type: blockType.time_type,
          emotional_weight: 'normal',
          status: 'committed',
          source: 'quick_capture',
        }),
      })
      if (aiRes.ok) {
        const ai = await aiRes.json()
        blockItem = { id: ai.id, name: blockType.name, time_type: blockType.time_type, emotional_weight: 'normal', status: 'committed' }
      }

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
            items: blockItem ? [blockItem] : [],
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

    // Virtual items (from dynamic Suggested) need a real DB record first
    let resolvedItem = item
    if (item.id.startsWith('activity:')) {
      const activityId = item.id.slice('activity:'.length)
      const activity = activities.find(a => a.id === activityId)
      const createRes = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activity?.name ?? activityId,
          source: 'template_proposal',
          activity_id: activityId,
          status: 'candidate',
        }),
      })
      if (!createRes.ok) return
      const newItem = await createRes.json()
      resolvedItem = { ...item, id: newItem.id }
      // Optimistically update coverage so the virtual item disappears from Suggested
      setScheduleCoverage(prev => [...prev, { activity_id: activityId, scheduled_date: ds }])
    }

    const snapTime = getTimeFromClientY(clientY)
    const duration = resolvedItem.duration_min > 0 ? resolvedItem.duration_min : 60
    const endTime = minutesToTime(timeToMinutes(snapTime) + duration)

    // Find matching block type from hint
    const hintBt = resolvedItem.block_type_hint
      ? blockTypes.find(bt => bt.name.toLowerCase() === resolvedItem.block_type_hint!.toLowerCase())
      : null

    try {
      const blockRes = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: ds,
          label: resolvedItem.name,
          start_time: snapTime,
          end_time: endTime,
          duration_minutes: duration,
          block_type_id: hintBt?.id ?? null,
          is_hard: false,
          sort_order: 0,
          source: 'manual',
          time_type: resolvedItem.time_type,
        }),
      })
      if (!blockRes.ok) return
      const newBlock = await blockRes.json()

      // Commit the action item: PATCH to set committed fields
      const commitRes = await fetch(`/api/action-items/${resolvedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committed_date: ds,
          time_block_id: newBlock.id,
          scheduled_time: snapTime,
          scheduled_end_time: endTime,
          status: 'committed',
        }),
      })
      if (!commitRes.ok) return

      const schedItem: ActionItemLocal = {
        id: resolvedItem.id,
        name: resolvedItem.name,
        time_type: resolvedItem.time_type,
        emotional_weight: resolvedItem.emotional_weight,
        status: 'committed',
      }

      setDayBlocks(prev => {
        const existing = prev[ds] ?? []
        return {
          ...prev,
          [ds]: [...existing, {
            id: newBlock.id,
            block_date: ds,
            label: resolvedItem.name,
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

      if (!isPersist) {
        setHopper(prev => prev.filter(h => h.id !== resolvedItem.id))
        setCarriedOverItems(prev => prev.filter(c => c.id !== resolvedItem.id))
      }
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

    // Virtual items (from dynamic Suggested) need a real DB record first
    let resolvedItem = item
    if (item.id.startsWith('activity:')) {
      const activityId = item.id.slice('activity:'.length)
      const activity = activities.find(a => a.id === activityId)
      const createRes = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activity?.name ?? activityId,
          source: 'template_proposal',
          activity_id: activityId,
          status: 'candidate',
        }),
      })
      if (!createRes.ok) return
      const newActionItem = await createRes.json()
      resolvedItem = { ...item, id: newActionItem.id }
      // Optimistically update coverage so the virtual item disappears from Suggested
      setScheduleCoverage(prev => [...prev, { activity_id: activityId, scheduled_date: ds }])
    }

    try {
      // Commit the action item: PATCH to set committed fields
      const res = await fetch(`/api/action-items/${resolvedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committed_date: ds,
          time_block_id: block.id,
          scheduled_time: block.start_time ?? null,
          scheduled_end_time: block.end_time ?? null,
          status: 'committed',
        }),
      })
      if (!res.ok) return

      const schedItem: ActionItemLocal = {
        id: resolvedItem.id,
        name: resolvedItem.name,
        time_type: resolvedItem.time_type,
        emotional_weight: resolvedItem.emotional_weight,
        status: 'committed',
      }

      const isFirst = block.items.length === 0
      if (isFirst) {
        fetch(`/api/time-blocks/${block.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: resolvedItem.name }),
        })
      }

      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return {
          ...prev,
          [ds]: dayList.map(b =>
            b.id === block.id
              ? { ...b, label: isFirst ? resolvedItem.name : b.label, items: [...b.items, schedItem] }
              : b
          ),
        }
      })

      // Only consume hopper item if not in persist mode
      if (!isPersist) {
        setHopper(prev => prev.filter(h => h.id !== resolvedItem.id))
        setCarriedOverItems(prev => prev.filter(c => c.id !== resolvedItem.id))
      }
    } catch (err) {
      console.error('Drop on block error:', err)
    }

    setDraggingHopperItem(null)
    setDragOverBlockId(null)
  }

  // ── Return to hopper ────────────────────────────────────────────────────────
  async function returnToHopper(item: ActionItemLocal, block: TimeBlockLocal, ds: string) {
    try {
      // PATCH action item back to candidate status, clearing committed fields
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
      })

      // Remove the item from the calendar block
      setDayBlocks(prev => {
        const dayList = prev[ds] ?? []
        return {
          ...prev,
          [ds]: dayList
            .map(b => b.id === block.id ? { ...b, items: b.items.filter(i => i.id !== item.id) } : b)
            .filter(b => b.items.length > 0),
        }
      })

      // Restore to hopper if it isn't already there
      setHopper(prev => {
        const alreadyPresent = prev.some(h => h.id === item.id)
        if (alreadyPresent) return prev
        const isAutoPlace = block.source === 'auto_place'
        const hopperItem: CandidateItemLocal = {
          id: item.id,
          name: item.name,
          source: isAutoPlace ? 'template_proposal' : 'quick_capture',
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          priority_tier: isAutoPlace ? 'suggested' : 'normal',
          priority_score: 50,
          block_type_hint: null,
          duration_min: 20,
          duration_max: 60,
          values: [],
          activity_id: null,
          preferred_time: null,
          frequency: null,
        }
        setReturningHopperIds(prev => new Set([...prev, item.id]))
        setTimeout(() => setReturningHopperIds(prev => { const s = new Set(prev); s.delete(item.id); return s }), 2000)
        if (hopperFilter !== 'all' && hopperFilter !== item.time_type) setHopperFilter('all')
        if (hopperShrunk) setHopperShrunk(false)
        return [hopperItem, ...prev]
      })
    } catch (err) {
      console.error('Return to hopper error:', err)
    }
  }

  // ── Mark complete ───────────────────────────────────────────────────────────
  async function markItemComplete(item: ActionItemLocal, block: TimeBlockLocal, ds: string) {
    try {
      setFlashingItemIds(prev => new Set([...prev, item.id]))
      await fetch(`/api/action-items/${item.id}`, {
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
      setTimeout(() => setFlashingItemIds(prev => { const s = new Set(prev); s.delete(item.id); return s }), 900)
    } catch (err) {
      console.error('Mark complete error:', err)
    }
  }

  // ── Dismiss hopper item ─────────────────────────────────────────────────────
  async function dismissHopperItem(id: string) {
    try {
      setExitingHopperIds(prev => new Set([...prev, id]))
      if (id.startsWith('activity:')) {
        const activityId = id.slice('activity:'.length)
        const activity = activities.find(a => a.id === activityId)
        setTimeout(() => {
          setDismissedVirtualIds(prev => new Set([...prev, activityId]))
          setExitingHopperIds(prev => { const s = new Set(prev); s.delete(id); return s })
        }, 360)
        // Persist the dismissal for this week to the DB
        fetch('/api/action-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: activity?.name ?? activityId,
            source: 'template_proposal',
            activity_id: activityId,
            status: 'dismissed',
            metadata: { dismissed_week: dateStr(weekStart) },
          }),
        }).then(res => res.ok ? res.json() : null).then(record => {
          if (!record) return
          setWeekDismissed(prev => [...prev, {
            id: record.id,
            name: record.name,
            source: 'template_proposal' as const,
            time_type: (activity?.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
            emotional_weight: 'normal' as const,
            priority_tier: 'suggested' as const,
            priority_score: 0,
            block_type_hint: null,
            duration_min: activity?.duration_range_min ?? 20,
            duration_max: activity?.duration_range_max ?? 60,
            values: [],
            activity_id: activityId,
            preferred_time: activity?.preferred_time ?? null,
            frequency: activity?.frequency ?? null,
          }])
        })
      } else {
        await fetch(`/api/action-items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dismissed', resolved_at: new Date().toISOString() }),
        })
        setTimeout(() => {
          setHopper(prev => prev.filter(h => h.id !== id))
          setExitingHopperIds(prev => { const s = new Set(prev); s.delete(id); return s })
        }, 360)
      }
    } catch (err) {
      console.error('Dismiss hopper error:', err)
    }
  }

  // ── Revive a week-dismissed suggested item ──────────────────────────────────
  async function reviveHopperItem(item: CandidateItemLocal) {
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', metadata: null }),
      })
      setWeekDismissed(prev => prev.filter(d => d.id !== item.id))
      if (item.activity_id) {
        setDismissedVirtualIds(prev => { const s = new Set(prev); s.delete(item.activity_id!); return s })
      }
    } catch (err) {
      console.error('Revive hopper error:', err)
    }
  }

  // ── Time-shift a hopper item to a future date ───────────────────────────────
  async function timeShiftItem(id: string, newDate: string) {
    setExitingHopperIds(prev => new Set([...prev, id]))
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposed_date: newDate }),
    })
    setTimeout(() => {
      setHopper(prev => prev.filter(h => h.id !== id))
      setExitingHopperIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 360)
  }

  // ── Commit a hopper item to today as an unscheduled to-do ───────────────────
  async function commitToToday(itemId: string) {
    const today = new Date().toISOString().split('T')[0]
    setExitingHopperIds(prev => new Set([...prev, itemId]))

    let actionItemId = itemId
    if (itemId.startsWith('activity:')) {
      const activityId = itemId.slice('activity:'.length)
      const activity = activities.find(a => a.id === activityId)

      // Check if an existing candidate for this activity is already in the hopper
      const existingCandidate = hopper.find(h => h.activity_id === activityId && !h.id.startsWith('activity:'))

      if (existingCandidate) {
        // Commit the existing candidate instead of creating a new item
        actionItemId = existingCandidate.id
        await fetch(`/api/action-items/${actionItemId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'committed', committed_date: today }),
        })
      } else {
        const createRes = await fetch('/api/action-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: activity?.name ?? activityId,
            source: 'template_proposal',
            activity_id: activityId,
            status: 'committed',
            committed_date: today,
            committed_at: new Date().toISOString(),
          }),
        })
        if (!createRes.ok) return
        const newItem = await createRes.json()
        actionItemId = newItem.id
      }
      setScheduleCoverage(prev => [...prev, { activity_id: activityId, scheduled_date: today }])
    } else {
      await fetch(`/api/action-items/${actionItemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'committed', committed_date: today }),
      })
    }

    setTimeout(() => {
      setHopper(prev => prev.filter(h => h.id !== itemId))
      setExitingHopperIds(prev => { const s = new Set(prev); s.delete(itemId); return s })
    }, 360)
  }

  // ── Permanently delete a hopper item ───────────────────────────────────────
  async function deleteHopperItem(id: string) {
    setExitingHopperIds(prev => new Set([...prev, id]))
    await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
    setTimeout(() => {
      setHopper(prev => prev.filter(h => h.id !== id))
      setExitingHopperIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 360)
  }

  // ── Delete block ────────────────────────────────────────────────────────────
  async function renameBlock(blockId: string, ds: string, newLabel: string) {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    const block = (dayBlocks[ds] ?? []).find(b => b.id === blockId)
    setDayBlocks(prev => ({
      ...prev,
      [ds]: (prev[ds] ?? []).map(b => b.id === blockId
        ? { ...b, label: trimmed, items: b.items.map((item, i) => i === 0 && item.name === b.label ? { ...item, name: trimmed } : item) }
        : b),
    }))
    setEditingBlockLabel(null)
    await fetch(`/api/time-blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: trimmed }),
    })
    // Also rename the primary action_item (the one whose name matches the old block label)
    const primaryItem = block?.items.find(i => i.name === block.label)
    if (primaryItem) {
      await fetch(`/api/action-items/${primaryItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
    }
  }

  async function deleteBlock(blockId: string, ds: string) {
    try {
      // Find block before removing it so we can restore hopper items
      const block = (dayBlocks[ds] ?? []).find(b => b.id === blockId)

      setExitingBlockIds(prev => new Set([...prev, blockId]))
      await fetch(`/api/time-blocks/${blockId}`, { method: 'DELETE' })
      setTimeout(() => {
        setDayBlocks(prev => {
          const dayList = prev[ds] ?? []
          return { ...prev, [ds]: dayList.filter(b => b.id !== blockId) }
        })
        setExitingBlockIds(prev => { const s = new Set(prev); s.delete(blockId); return s })
      }, 260)

      // Delete any action items linked to this block
      if (block && block.items.length > 0) {
        await Promise.all(block.items.map(i =>
          fetch(`/api/action-items/${i.id}`, { method: 'DELETE' })
        ))
      }
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
      // Also update scheduled_time on linked action_items so /today reflects the change
      for (const item of block.items) {
        await fetch(`/api/action-items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduled_time: newStartTime,
            scheduled_end_time: newEndTime,
            ...(fromDate !== toDate ? { committed_date: toDate } : {}),
          }),
        })
      }
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

      // Duplicate each action item onto the new block (new action_items with committed status)
      // If original block has no items, create one from the block label
      const newItems: ActionItemLocal[] = []
      const itemsToDuplicate = block.items.length > 0 ? block.items : [{ name: block.label, time_type: block.block_type?.time_type ?? 'B', emotional_weight: 'normal' as const }]
      await Promise.all(itemsToDuplicate.map(async item => {
        const aiRes = await fetch('/api/action-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            committed_date: toDate,
            time_block_id: newBlock.id,
            scheduled_time: newStartTime,
            scheduled_end_time: newEndTime,
            time_type: item.time_type,
            emotional_weight: item.emotional_weight,
            status: 'committed',
          }),
        })
        if (aiRes.ok) {
          const ai = await aiRes.json()
          newItems.push({
            id: ai.id,
            name: item.name,
            time_type: item.time_type,
            emotional_weight: item.emotional_weight,
            status: 'committed',
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
      // Return each item to candidate status
      await Promise.all(block.items.map(async item => {
        await fetch(`/api/action-items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
        })
      }))
      await fetch(`/api/time-blocks/${block.id}`, { method: 'DELETE' })

      setDayBlocks(prev => ({
        ...prev,
        [ds]: (prev[ds] ?? []).filter(b => b.id !== block.id),
      }))

      // Restore items in hopper state
      const returning: CandidateItemLocal[] = block.items
        .map(item => ({
          id: item.id,
          name: item.name,
          source: (block.source === 'auto_place' ? 'template_proposal' : 'quick_capture') as CandidateItemLocal['source'],
          time_type: item.time_type,
          emotional_weight: item.emotional_weight,
          priority_tier: (block.source === 'auto_place' ? 'suggested' : 'normal') as 'suggested' | 'normal',
          priority_score: 50,
          block_type_hint: null,
          duration_min: 20,
          duration_max: 60,
          values: [],
          activity_id: null,
          preferred_time: null,
          frequency: null,
        }))
      if (returning.length > 0) {
        setHopper(prev => {
          const existingIds = new Set(prev.map(h => h.id))
          const toAdd = returning.filter(r => !existingIds.has(r.id))
          return toAdd.length > 0 ? [...toAdd, ...prev] : prev
        })
      }
    } catch (err) {
      console.error('Delete block with items error:', err)
    }
  }

  // ── Quick capture ───────────────────────────────────────────────────────────
  const [captureToast, setCaptureToast] = useState<string | null>(null)
  const [logToast, setLogToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showLogToast = (message: string, type: 'success' | 'error' = 'success') => {
    setLogToast({ message, type })
    setTimeout(() => setLogToast(null), 5000)
  }

  async function handleQuickCapture(e: React.FormEvent) {
    e.preventDefault()
    const text = captureInput.trim()
    if (!text) return
    setCaptureInput('')
    try {
      const textNoQuotes = text.replace(/["'][^"']*["']/g, '')
      const isScheduled = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(textNoQuotes) || /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(textNoQuotes)
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: text, source: 'organize', deferScheduling: isScheduled }),
      })
      if (!res.ok) return
      const data = await res.json()
      const parsed = data.parsed

      if (parsed?.outcome === 'logged') {
        showLogToast(`Logged: ${parsed.cleanedName}`)
        return
      }

      // For scheduled items, show confirmation instead of auto-scheduling
      if (isScheduled && (parsed?.outcome === 'scheduled_soft' || parsed?.outcome === 'scheduled_hard') && parsed?.time && data.actionItem) {
        setScheduleConfirm({
          itemId: data.actionItem.id,
          name: parsed.cleanedName,
          date: parsed.date ?? dateStr(new Date()),
          time: parsed.time,
          endTime: parsed.endTime,
        })
        return
      }

      // For all other outcomes, add to hopper
      const hi = data.actionItem
      if (hi) {
        const hopperItem: CandidateItemLocal = {
          id: hi.id,
          name: parsed?.cleanedName ?? hi.name ?? text,
          source: 'quick_capture',
          time_type: parsed?.timeType ?? 'B',
          emotional_weight: 'normal',
          priority_tier: 'normal',
          priority_score: 50,
          block_type_hint: null,
          duration_min: 20,
          duration_max: 60,
          values: [],
          activity_id: null,
          preferred_time: null,
          frequency: null,
        }
        if (hopperFilter !== 'all' && hopperFilter !== hopperItem.time_type) setHopperFilter('all')
        if (hopperShrunk) setHopperShrunk(false)
        setHopper(prev => [...prev, hopperItem])
      }
    } catch (err) {
      console.error('Quick capture error:', err)
    }
  }

  async function confirmScheduleCapture() {
    if (!scheduleConfirm) return
    const { itemId, date, time, endTime, name } = scheduleConfirm
    const blockRes = await fetch('/api/time-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_date: date, label: name, start_time: time, end_time: endTime, source: 'manual' }),
    })
    const block = blockRes.ok ? await blockRes.json() : null
    await fetch(`/api/action-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'committed', committed_date: date, scheduled_time: time, scheduled_end_time: endTime, time_block_id: block?.id ?? null }),
    })
    setScheduleConfirm(null)
    loadData()
  }

  function dismissScheduleCapture() {
    if (!scheduleConfirm) return
    // Item exists as candidate — add to hopper
    const hopperItem: CandidateItemLocal = {
      id: scheduleConfirm.itemId,
      name: scheduleConfirm.name,
      source: 'quick_capture',
      time_type: 'B',
      emotional_weight: 'normal',
      priority_tier: 'normal',
      priority_score: 50,
      block_type_hint: null,
      duration_min: 20,
      duration_max: 60,
      values: [],
      activity_id: null,
      preferred_time: null,
      frequency: null,
    }
    if (hopperFilter !== 'all') setHopperFilter('all')
    if (hopperShrunk) setHopperShrunk(false)
    setHopper(prev => [...prev, hopperItem])
    setScheduleConfirm(null)
  }

  // ── Log a hopper item ────────────────────────────────────────────────────────
  async function handleLogHopperItem(itemId: string, itemName: string) {
    try {
      const today = dateStr(new Date())
      await fetch('/api/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'logged',
          event_date: today,
          note: itemName,
          action_item_id: itemId,
        }),
      })
      // Archive the action item
      await fetch(`/api/action-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      setHopper(prev => prev.filter(h => h.id !== itemId))
      showLogToast(`Logged: ${itemName}`)
    } catch (err) {
      console.error('Log hopper item error:', err)
    }
  }

  async function handleSaveActivity(data: Record<string, unknown>) {
    if (editingActivityId === 'new') {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setActivities(prev => [...prev, {
          id: created.id, name: created.name, time_type: created.time_type,
          emotional_weight: created.emotional_weight, frequency: created.frequency,
          duration_range_min: created.duration_range_min, duration_range_max: created.duration_range_max,
          preferred_time: created.preferred_time,
        }])
      }
    } else if (editingActivityId) {
      const res = await fetch(`/api/activities/${editingActivityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setActivities(prev => prev.map(a => a.id === editingActivityId ? {
          ...a, name: updated.name, time_type: updated.time_type,
          emotional_weight: updated.emotional_weight, frequency: updated.frequency,
          duration_range_min: updated.duration_range_min, duration_range_max: updated.duration_range_max,
          preferred_time: updated.preferred_time,
        } : a))
        // Update any matching hopper items with new name/type
        setHopper(prev => prev.map(h => h.activity_id === editingActivityId ? {
          ...h, name: updated.name, time_type: updated.time_type,
          emotional_weight: updated.emotional_weight, preferred_time: updated.preferred_time,
        } : h))
      }
    }
    setEditingActivityId(null)
    setEditingActivityPrefillName('')
    setEditingActivityFull(null)
  }

  async function handleAutoPlace(itemId: string, overrides?: { preferred_time: string; duration_minutes: number }, force?: boolean) {
    // Virtual items (from dynamic Suggested) have no DB record yet — create one first
    let actionItemId = itemId
    if (itemId.startsWith('activity:')) {
      const activityId = itemId.slice('activity:'.length)
      const activity = activities.find(a => a.id === activityId)
      const createRes = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activity?.name ?? activityId,
          source: 'template_proposal',
          activity_id: activityId,
          status: 'candidate',
        }),
      })
      if (!createRes.ok) return
      const newItem = await createRes.json()
      actionItemId = newItem.id
    }

    const res = await fetch('/api/action-items/auto-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: actionItemId, week_start: dateStr(weekStart), utc_offset_minutes: new Date().getTimezoneOffset(), force: force ?? false, ...overrides }),
    })
    if (!res.ok) return
    const { created } = await res.json()
    if (!created?.length) return  // nothing placed — leave hopper item in place

    // Add new blocks (with their items) to dayBlocks state
    setDayBlocks(prev => {
      const next = { ...prev }
      for (const { block, item: si } of created) {
        const ds: string = block.block_date
        if (!next[ds]) next[ds] = []
        const startMin = timeToMinutes(block.start_time)
        const endMin = timeToMinutes(block.end_time)
        const newBlock: TimeBlockLocal = {
          id: block.id,
          block_date: ds,
          label: block.label,
          start_time: block.start_time,
          end_time: block.end_time,
          duration_minutes: endMin - startMin,
          is_hard: false,
          block_type_id: null,
          block_type: undefined,
          source: 'auto_place',
          items: [{
            id: si.id,
            name: si.name,
            time_type: si.time_type ?? 'B',
            emotional_weight: si.emotional_weight ?? 'normal',
            status: 'committed',
          }],
        }
        next[ds] = [...next[ds], newBlock]
      }
      return next
    })
    // Remove from hopper (virtual items aren't in hopper state — they disappear
    // automatically once coverage is updated, but update coverage optimistically)
    if (itemId.startsWith('activity:')) {
      const activityId = itemId.slice('activity:'.length)
      setScheduleCoverage(prev => [...prev, { activity_id: activityId, scheduled_date: dateStr(weekStart) }])
    } else {
      setHopper(prev => prev.filter(h => h.id !== itemId))
    }

    // Highlight new blocks and scroll to the earliest one
    const newIds = new Set<string>(created.map((c: { block: { id: string } }) => c.block.id))
    setNewlyPlacedIds(newIds)
    setTimeout(() => setNewlyPlacedIds(new Set()), 2500)

    const earliestStart = created.reduce(
      (min: string, c: { block: { start_time: string } }) => c.block.start_time < min ? c.block.start_time : min,
      created[0].block.start_time
    )
    const scrollTo = Math.max(0, (timeToMinutes(earliestStart) - GRID_START * 60) * (HOUR_HEIGHT / 60) - 80)
    requestAnimationFrame(() => {
      gridScrollRef.current?.scrollTo({ top: scrollTo, behavior: 'smooth' })
    })
  }

  async function deleteFloatingItem(fi: FloatingActionItem) {
    try {
      // Return the action item to candidate status
      await fetch(`/api/action-items/${fi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
      })
      const hopperItem: CandidateItemLocal = {
        id: fi.id,
        name: fi.name,
        source: 'template_proposal',
        time_type: fi.time_type,
        emotional_weight: 'normal',
        priority_tier: 'suggested',
        priority_score: 50,
        block_type_hint: null,
        duration_min: 30,
        duration_max: 60,
        values: [],
        activity_id: fi.activity_id,
        preferred_time: null,
        frequency: null,
      }
      setHopper(prev => [hopperItem, ...prev.filter(h => h.id !== hopperItem.id)])
      setFloatingItems(prev => {
        const next = { ...prev }
        next[fi.committed_date] = (next[fi.committed_date] ?? []).filter(x => x.id !== fi.id)
        return next
      })
    } catch (err) {
      console.error('Delete floating item error:', err)
    }
  }


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

  // ── Day span CRUD ──────────────────────────────────────────────────────────
  async function saveSpan(span: DaySpanLocal) {
    const isNew = !span.id
    const url = isNew ? '/api/day-spans' : `/api/day-spans/${span.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: span.name,
        start_date: span.start_date,
        end_date: span.end_date,
        person_id: span.person_id || null,
        color: span.color || null,
        note: span.note || null,
        value_links: span.value_links.map(vl => ({
          value_id: vl.value_id,
          contribution_strength: vl.contribution_strength,
        })),
      }),
    })
    if (!res.ok) return
    const saved = await res.json()
    if (isNew) {
      setDaySpans(prev => [...prev, saved])
    } else {
      setDaySpans(prev => prev.map(s => s.id === saved.id ? saved : s))
    }
    setEditingSpan(null)
  }

  async function deleteSpan(spanId: string) {
    await fetch(`/api/day-spans/${spanId}`, { method: 'DELETE' })
    setDaySpans(prev => prev.filter(s => s.id !== spanId))
    setEditingSpan(null)
  }

  // ── Calendar classification ─────────────────────────────────────────────────
  async function saveClassification() {
    if (!classifying) return
    const { event, classification, displayLabel, energyLevel, applyToSeries, hiding } = classifying
    const effectiveClassification = hiding ? 'hidden' : classification

    const matchKey = applyToSeries && event.external_series_id
      ? event.external_series_id
      : event.external_event_id
    const matchType = applyToSeries && event.external_series_id ? 'series' : 'event'

    // Optimistically update local state so the grid changes immediately
    setCalEvents(prev => prev.map(ev => {
      const evKey = ev.external_series_id && applyToSeries ? ev.external_series_id : ev.external_event_id
      if (evKey !== matchKey) return ev
      return { ...ev, classification: { classification: effectiveClassification as CalEventLocal['classification'] extends { classification: infer T } | null ? T : never, display_label: displayLabel || null } }
    }))
    setClassifying(null)

    // Always suppress confirmed/hidden events regardless of future changes in Google.
    // null fingerprint = permanent suppression by event/series ID.
    const suppressedFingerprint = null

    try {
      await fetch('/api/calendar/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_key: matchKey,
          match_type: matchType,
          classification: effectiveClassification,
          display_label: displayLabel || null,
          time_type: energyLevel,
          suppressed_fingerprint: suppressedFingerprint,
        }),
      })

      if (!hiding && classification === 'fixed_commitment') {
        // Create action_item(s) so the event appears on Today with its time.
        // For a series, create for all matching loaded events. For a single event, just that one.
        const eventsToSchedule: CalEventLocal[] = applyToSeries && event.external_series_id
          ? calEvents.filter(e => e.external_series_id === event.external_series_id && !e.is_all_day)
          : (event.is_all_day ? [] : [event])

        const scheduledEventIds = new Set<string>()

        await Promise.all(eventsToSchedule.map(async ev => {
          const start = new Date(ev.start_time)
          const end = new Date(ev.end_time)
          const scheduledDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
          const scheduledTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
          const scheduledEndTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
          const label = displayLabel || ev.title

          // Avoid duplicates: check if an action_item with this time+name already exists.
          // DB stores time as "HH:MM:SS" so compare only first 5 chars.
          const checkRes = await fetch(`/api/action-items?committed_date=${scheduledDate}`)
          const existing: { name: string; scheduled_time: string | null }[] = checkRes.ok ? await checkRes.json() : []
          if (existing.some(s => (s.scheduled_time ?? '').slice(0, 5) === scheduledTime && s.name === label)) {
            scheduledEventIds.add(ev.external_event_id)
            return
          }

          // Create a time_block first, then link the action_item to it
          const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))
          const blockRes = await fetch('/api/time-blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              block_date: scheduledDate,
              label,
              start_time: scheduledTime,
              end_time: scheduledEndTime,
              duration_minutes: durationMin,
              is_hard: false,
              sort_order: 0,
              source: 'calendar_import',
              time_type: energyLevel ?? 'B',
            }),
          })
          const newBlock = blockRes.ok ? await blockRes.json() : null

          await fetch('/api/action-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: label,
              committed_date: scheduledDate,
              scheduled_time: scheduledTime,
              scheduled_end_time: scheduledEndTime,
              time_block_id: newBlock?.id ?? null,
              flexibility: 'soft_scheduled',
              time_type: energyLevel ?? 'B',
              bounding_type: 'time',
              emotional_weight: 'normal',
              status: 'committed',
              metadata: { calendar_event_id: ev.external_event_id },
            }),
          })
          scheduledEventIds.add(ev.external_event_id)
        }))

        // Remove confirmed events from the calendar overlay — the action_item represents them now.
        // This prevents the event showing twice (once as overlay, once as block).
        setCalEvents(prev => prev.filter(e => !scheduledEventIds.has(e.external_event_id)))

        await loadData()
      }

      if (!hiding && classification === 'flexible_commitment') {
        await fetch('/api/action-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: displayLabel || event.title, source: 'outside_request', status: 'candidate' }),
        })
        await loadData()
      }
    } catch (err) {
      console.error('Classify error:', err)
    }
  }

  async function hideCalEvent(ev: CalEventLocal) {
    // Optimistically remove from view immediately
    setCalEvents(prev => prev.filter(e => e.id !== ev.id))
    // Delete the row and save hidden classification so sync won't re-add it
    fetch(`/api/calendar/events/${ev.id}`, { method: 'DELETE' }).catch(console.error)
  }

  function openClassifyDialog(ev: CalEventLocal) {
    const existingClass = ev.classification?.classification
    setClassifying({
      event: ev,
      classification: (existingClass === 'info' || existingClass === 'fixed_commitment' || existingClass === 'flexible_commitment')
        ? existingClass
        : 'info',
      displayLabel: ev.classification?.display_label ?? ev.title,
      energyLevel: 'B',
      applyToSeries: !!ev.external_series_id,
    })
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
  const today = tzTodayStr ?? todayStr()

  const weekLabel = useMemo(() => {
    const start = weekStart
    const end = addDays(weekStart, 6)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (start.getMonth() === end.getMonth()) {
      return `${months[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
    }
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`
  }, [weekStart])

  const weekRelativeInfo = useMemo(() => {
    const now = new Date()
    const thisMonday = getMondayOf(now)
    const offset = Math.round((weekStart.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const labels: Record<number, string> = { 0: 'This Week', 1: 'Next Week', 2: '2 Weeks Out', 3: '3 Weeks Out', [-1]: 'Last Week', [-2]: '2 Weeks Ago', [-3]: '3 Weeks Ago' }
    const label = labels[offset] ?? (offset > 0 ? `${offset} Weeks Out` : `${-offset} Weeks Ago`)
    const color = offset < 0 ? '#B8443E' : offset === 0 ? '#2D2A26' : '#4B6A82'
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const monthPrefix = MONTHS[weekStart.getMonth()]
    return { label, color, monthPrefix }
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

  const TIME_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
  function sortByTime<T extends { preferred_time?: string | null }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const ao = a.preferred_time ? (TIME_ORDER[a.preferred_time] ?? 3) : 3
      const bo = b.preferred_time ? (TIME_ORDER[b.preferred_time] ?? 3) : 3
      return ao - bo
    })
  }

  const urgentHopper = useMemo(() => sortByTime(filteredHopper.filter(i => i.priority_tier === 'urgent')), [filteredHopper])
  const normalHopper = useMemo(() => sortByTime(filteredHopper.filter(i => i.priority_tier === 'normal')), [filteredHopper])

  // Dynamic Suggested: activities not covered within their cadence window
  const suggestedHopper = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // Build set of activity_ids already scheduled this week (direct check)
    const scheduledThisWeek = new Set<string>()
    const ws = weekStart; const we = addDays(ws, 7)
    for (const { activity_id, scheduled_date } of scheduleCoverage) {
      const d = new Date(scheduled_date + 'T00:00:00')
      if (d >= ws && d < we) scheduledThisWeek.add(activity_id)
    }
    for (const [, blocks] of Object.entries(dayBlocks)) {
      for (const block of blocks) {
        for (const item of block.items) {
          if (item.activity_id) scheduledThisWeek.add(item.activity_id)
        }
      }
    }
    for (const [, fis] of Object.entries(floatingItems)) {
      for (const fi of fis) {
        if (fi.activity_id) scheduledThisWeek.add(fi.activity_id)
      }
    }

    // Build coverage map for cadence window check
    const coverageMap: Record<string, Date[]> = {}
    for (const { activity_id, scheduled_date } of scheduleCoverage) {
      if (!coverageMap[activity_id]) coverageMap[activity_id] = []
      coverageMap[activity_id].push(new Date(scheduled_date + 'T00:00:00'))
    }

    // Activities already in the hopper (as real items) shouldn't appear in Suggested
    const hopperActivityIds = new Set(hopper.filter(h => h.activity_id).map(h => h.activity_id!))

    const virtual: CandidateItemLocal[] = activities
      .filter(a => a.frequency && CADENCE_DAYS[a.frequency])
      .filter(a => !hopperActivityIds.has(a.id))
      .filter(a => !dismissedVirtualIds.has(a.id))
      // Primary: already scheduled this week — suppress
      .filter(a => !scheduledThisWeek.has(a.id))
      // Secondary: cadence window
      .filter(a => {
        const cadenceDays = CADENCE_DAYS[a.frequency!]
        const windowMs = cadenceDays * 24 * 60 * 60 * 1000
        const dates = coverageMap[a.id] ?? []
        return !dates.some(d => Math.abs(d.getTime() - today.getTime()) <= windowMs)
      })
      .map(a => ({
        id: `activity:${a.id}`,
        name: a.name,
        source: 'template_proposal' as const,
        time_type: a.time_type,
        emotional_weight: a.emotional_weight,
        priority_tier: 'suggested' as const,
        priority_score: 0,
        block_type_hint: null,
        duration_min: a.duration_range_min ?? 30,
        duration_max: a.duration_range_max ?? 60,
        values: [],
        activity_id: a.id,
        preferred_time: a.preferred_time,
        frequency: a.frequency,
      }))

    // Apply time_type filter if active
    const filtered = hopperFilter === 'all' ? virtual : virtual.filter(i => i.time_type === hopperFilter)
    const PT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
    return filtered.sort((a, b) => {
      const ao = a.preferred_time ? (PT_ORDER[a.preferred_time] ?? 3) : 3
      const bo = b.preferred_time ? (PT_ORDER[b.preferred_time] ?? 3) : 3
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name)
    })
  }, [activities, scheduleCoverage, dayBlocks, floatingItems, hopper, dismissedVirtualIds, hopperFilter])

  // Completed items by day for Done tab
  const completedByDay = useMemo(() => {
    const byDay: Record<string, Array<{ item: ActionItemLocal; blockLabel: string }>> = {}
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
    <>
    <style>{`
      @keyframes auto-place-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(75,130,175,0.8), 0 0 0 0 rgba(75,130,175,0.4); }
        40%  { box-shadow: 0 0 0 6px rgba(75,130,175,0.3), 0 0 12px 4px rgba(75,130,175,0.15); }
        100% { box-shadow: 0 0 0 0 rgba(75,130,175,0), 0 0 0 0 rgba(75,130,175,0); }
      }
      @keyframes hopper-dismiss {
        0%   { opacity: 1; transform: translateX(0); max-height: 120px; margin-bottom: 4px; }
        100% { opacity: 0; transform: translateX(-16px); max-height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
      }
      @keyframes block-exit {
        0%   { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.93); }
      }
      @keyframes item-complete-flash {
        0%   { background: transparent; }
        20%  { background: rgba(90,158,111,0.35); }
        100% { background: rgba(90,158,111,0.04); }
      }
      @keyframes hopper-return {
        0%   { box-shadow: 0 0 0 0 rgba(158,106,70,0.8); }
        40%  { box-shadow: 0 0 0 6px rgba(158,106,70,0.25); }
        100% { box-shadow: 0 0 0 0 rgba(158,106,70,0); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `}</style>
    <div
      style={isPage ? {
        fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif',
      } : {
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
      onClick={!isPage ? (e => { if (e.target === e.currentTarget && onClose) onClose() }) : undefined}
    >
      <div
        style={isPage ? {
          width: '100%',
          height: 'calc(100vh - 41px)',
          background: '#FAFAF7',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        } : {
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
          <span style={{ fontWeight: 600, fontSize: 24, color: '#2D2A26', fontFamily: "'Source Sans 3', sans-serif" }}>
            Organize
          </span>
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
            {calConnected && (
              <button
                onClick={async () => {
                  if (syncing) return
                  setSyncing(true)
                  try {
                    const res = await fetch('/api/calendar/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                    if (res.ok) await loadData()
                  } finally {
                    setSyncing(false)
                  }
                }}
                disabled={syncing}
                style={{ fontSize: 10, color: syncing ? '#B5B0A8' : '#4B82AF', background: 'none', border: 'none', cursor: syncing ? 'default' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <span style={{ display: 'inline-block', animation: syncing ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
          </div>
          <div style={{ marginLeft: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 600, color: weekRelativeInfo.color, fontFamily: "'Source Sans 3', sans-serif", lineHeight: 1 }}>
              {weekRelativeInfo.label}
            </span>
            {weekRelativeInfo.monthPrefix && (
              <span style={{ fontSize: 24, fontWeight: 600, color: weekRelativeInfo.color, opacity: 0.6, fontFamily: "'Source Sans 3', sans-serif", lineHeight: 1 }}>
                {weekRelativeInfo.monthPrefix}
              </span>
            )}
          </div>
          {/* C&C link + create statement */}
          {(() => {
            const today = new Date()
            const dow = today.getDay() // 0=Sun
            const showCCLink = dow === 0 || dow === 1 || dow === 5 || dow === 6 // Fri/Sat/Sun/Mon
            const weekMonday = dateStr(weekStart)
            const ccComplete = thisWeekRecord?.completed_at_ritual && thisWeekRecord?.created_at_ritual && thisWeekRecord?.organized_at && thisWeekRecord?.deconflicted_at
            return (
              <>
                {thisWeekRecord?.create_statement && (
                  <span title={thisWeekRecord.create_statement} style={{ fontSize: 12, color: '#8A857D', fontStyle: 'italic', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    {thisWeekRecord.create_statement.length > 70 ? thisWeekRecord.create_statement.slice(0, 67) + '…' : thisWeekRecord.create_statement}
                  </span>
                )}
                {showCCLink && !ccComplete && (
                  <a href={`/cc/${weekMonday}`} style={{ fontSize: 12, color: '#8A857D', textDecoration: 'none', marginLeft: 8, whiteSpace: 'nowrap' }}>· Complete this week →</a>
                )}
                {ccComplete && (
                  <span style={{ fontSize: 12, color: '#B5B0A8', marginLeft: 8, whiteSpace: 'nowrap' }}>✓ Week created</span>
                )}
              </>
            )
          })()}
          <div style={{ flex: 1 }} />
          {loading && (
            <span style={{ fontSize: 11, color: '#B5B0A8', marginRight: 8 }}>Loading…</span>
          )}
          {!isPage && onClose && (
            <button
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          )}
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
            {(() => {
              const active = blockTypes.filter(bt => bt.is_active)
              const contextBlocks = active.filter(bt => bt.sort_order <= 2)
              const protectionBlocks = active.filter(bt => bt.sort_order > 2)
              const renderBt = (bt: BlockType) => (
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
                    borderRadius: 4,
                    border: `1px solid ${bt.color}4D`,
                    background: `${bt.color}26`,
                    cursor: 'grab',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#2D2A26',
                    userSelect: 'none',
                    boxShadow: draggingBlockTypeId === bt.id ? `0 2px 8px ${bt.color}30` : undefined,
                    opacity: draggingBlockTypeId && draggingBlockTypeId !== bt.id ? 0.5 : 1,
                  }}
                >
                  {bt.icon && <span style={{ fontSize: 14 }}>{bt.icon}</span>}
                  <span>{bt.name}</span>
                  <span style={{ fontSize: 10, color: '#8A857D', marginLeft: 2 }}>
                    {bt.name === 'Desk' ? `${focusMinutes}m` : `${bt.default_duration_minutes}m`}
                  </span>
                </div>
              )
              return (
                <>
                  {contextBlocks.map(renderBt)}
                  {contextBlocks.length > 0 && protectionBlocks.length > 0 && (
                    <div style={{ width: 1, height: 24, background: '#D5D0C8', flexShrink: 0, margin: '0 4px' }} />
                  )}
                  {protectionBlocks.map(renderBt)}
                </>
              )
            })()}
            <div style={{ flex: 1 }} />
            {blockTypes.find(bt => bt.name === 'Desk') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8A857D' }}>Desk:</span>
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
                    <option value="C">C Connection</option>
                    <option value="D">D Restore</option>
                    <option value="0">0 Free</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Active Outcomes bar ──────────────────────────────────────────── */}
        {outcomes.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            padding: '6px 18px', background: '#FBFAF6', borderBottom: '1px solid #E8E4DC', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Outcomes</span>
            {outcomes.map(o => {
              const isClosed = o.status === 'achieved' || o.status === 'abandoned'
              const closedDate = o.completed_at ? new Date(o.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
              const closedLabel = o.status === 'achieved' ? `accomplished ${closedDate}` : o.status === 'abandoned' ? `abandoned ${closedDate}` : ''
              return (
                <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 12,
                    color: isClosed ? '#8A857D' : '#2D2A26',
                    textDecoration: isClosed ? 'line-through' : 'none',
                  }}>
                    {o.name}
                  </span>
                  {isClosed ? (
                    <span style={{ fontSize: 10, color: o.status === 'achieved' ? '#5A9E6F' : '#8A857D' }}>{closedLabel}</span>
                  ) : nudgingOutcomeId === o.id ? (
                    <input
                      autoFocus
                      value={nudgeInput}
                      onChange={e => setNudgeInput(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Escape') { setNudgingOutcomeId(null); setNudgeInput('') }
                        if (e.key === 'Enter' && nudgeInput.trim()) {
                          e.preventDefault()
                          const res = await fetch('/api/action-items', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: nudgeInput.trim(), source: 'quick_capture', status: 'candidate', big_outcome_id: o.id, time_type: 'B', emotional_weight: 'normal' }),
                          })
                          if (res.ok) {
                            const ai = await res.json()
                            setHopper(prev => [{ id: ai.id, name: ai.name, source: 'quick_capture', time_type: 'B', emotional_weight: 'normal', priority_tier: 'normal', priority_score: 50, block_type_hint: null, duration_min: 20, duration_max: 60, values: [], activity_id: null, big_outcome_id: o.id, preferred_time: null, frequency: null }, ...prev])
                          }
                          setNudgingOutcomeId(null)
                          setNudgeInput('')
                        }
                      }}
                      onBlur={() => { setNudgingOutcomeId(null); setNudgeInput('') }}
                      placeholder="Nudge: …"
                      style={{ fontSize: 11, border: '1px solid #E0DDD6', borderRadius: 4, padding: '2px 6px', background: '#FFF', color: '#2D2A26', outline: 'none', width: 160 }}
                    />
                  ) : (
                    <span
                      onClick={() => { setNudgingOutcomeId(o.id); setNudgeInput('') }}
                      style={{ fontSize: 12, color: '#4B6A82', cursor: 'pointer' }}
                    >Nudge →</span>
                  )}
                </span>
              )
            })}
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
              {(hopper.length + carriedOverItems.length) > 0 && (
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#C4725A', color: '#FFF', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(hopper.length + carriedOverItems.length) > 9 ? '9+' : hopper.length + carriedOverItems.length}
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
                {!loading && filteredHopper.length === 0 && suggestedHopper.length === 0 && carriedOverItems.length === 0 && (
                  <div style={{ color: '#B5B0A8', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>
                    {hopper.length === 0 ? 'Hopper is empty' : 'No items match filter'}
                  </div>
                )}

                {/* Quick capture — above hopper items for easy access */}
                <div style={{ marginBottom: 8 }}>
                  {logToast && (
                    <div style={{
                      marginBottom: 6,
                      background: logToast.type === 'error' ? '#FDF5F4' : '#F4FDF7',
                      border: `1px solid ${logToast.type === 'error' ? '#C4504A40' : '#5A9E6F40'}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: logToast.type === 'error' ? '#C4504A' : '#4A8B5E',
                    }}>
                      {logToast.message}
                    </div>
                  )}
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
                  {scheduleConfirm && (
                    <div style={{
                      marginTop: 6, background: '#FFF', border: '1px solid #E8E4DC',
                      borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', marginBottom: 3 }}>
                        {scheduleConfirm.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 6 }}>
                        Schedule at {(() => { const [h, m] = scheduleConfirm.time.split(':').map(Number); const ampm = h >= 12 ? 'pm' : 'am'; const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return m === 0 ? `${hr}${ampm}` : `${hr}:${String(m).padStart(2, '0')}${ampm}` })()}?
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span onClick={confirmScheduleCapture} style={{ fontSize: 11, color: '#5A9E6F', cursor: 'pointer', fontWeight: 600 }}>Schedule</span>
                        <span onClick={dismissScheduleCapture} style={{ fontSize: 11, color: '#8A8578', cursor: 'pointer' }}>Just capture</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Carried Over — committed items from past weeks */}
                {carriedOverItems.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#C4725A', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                      CARRIED OVER
                    </div>
                    {carriedOverItems.map(item => {
                      const fmtDate = new Date(item.committed_date + 'T12:00:00')
                      const dateLabel = fmtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggingHopperItem({
                            id: item.id,
                            name: item.name,
                            source: 'planning_function',
                            time_type: item.time_type,
                            emotional_weight: item.emotional_weight,
                            priority_tier: 'urgent',
                            priority_score: 100,
                            block_type_hint: null,
                            duration_min: 30,
                            duration_max: 60,
                            values: [],
                            activity_id: null,
                            preferred_time: null,
                            frequency: null,
                          })}
                          onDragEnd={() => setDraggingHopperItem(null)}
                          style={{
                            padding: '6px 8px',
                            marginBottom: 3,
                            borderRadius: 6,
                            background: '#FFF',
                            border: '1px solid #E8E4DC',
                            borderLeft: `3px solid ${EC[item.time_type] ?? '#B5B0A8'}`,
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {item.status === 'in_progress' ? (
                            <span style={{
                              width: 10, height: 10, border: '1.5px solid #C4725A', borderRadius: 1,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <span style={{ width: 4, height: 4, background: '#C4725A', borderRadius: 1 }} />
                            </span>
                          ) : (
                            <span style={{
                              width: 10, height: 10, border: '1.5px solid #8A857D', borderRadius: 1, flexShrink: 0,
                            }} />
                          )}
                          <span style={{ fontSize: 12, color: '#2D2A26', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: 9, color: '#B5B0A8', flexShrink: 0 }}>{dateLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* This Week — merged urgent + normal */}
                {(urgentHopper.length > 0 || normalHopper.length > 0) && (
                  <div style={{ marginBottom: 8 }}>
                    {suggestedHopper.length > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#8A857D', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
                        THIS WEEK
                      </div>
                    )}
                    {[...urgentHopper, ...normalHopper].map(item => (
                      <HopperItemCard
                        key={item.id}
                        item={item}
                        outcomes={outcomes}
                        onDismiss={() => dismissHopperItem(item.id)}
                        onLog={() => handleLogHopperItem(item.id, item.name)}
                        onDragStart={() => setDraggingHopperItem(item)}
                        onDragEnd={() => { setDraggingHopperItem(null); setHopperDuplicateArmed(null) }}
                        onContextMenu={e => { e.preventDefault(); setHopperDuplicateArmed(prev => prev === item.id ? null : item.id) }}
                        onDoubleClick={() => item.activity_id ? openActivityEditor(item.activity_id) : undefined}
                        onMakeActivity={!item.activity_id ? () => { setEditingActivityPrefillName(item.name); setEditingActivityId('new') } : undefined}
                        onAutoPlace={(overrides, force) => handleAutoPlace(item.id, overrides, force)}
                        onCommitToday={() => commitToToday(item.id)}
                        onTimeShift={(date) => timeShiftItem(item.id, date)}
                        onDelete={() => deleteHopperItem(item.id)}
                        dragging={draggingHopperItem?.id === item.id}
                        armed={hopperDuplicateArmed === item.id}
                        isExiting={exitingHopperIds.has(item.id)}
                        isReturning={returningHopperIds.has(item.id)}
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
                        outcomes={outcomes}
                        onDismiss={() => dismissHopperItem(item.id)}
                        isVirtual={item.id.startsWith('activity:')}
                        onDragStart={() => setDraggingHopperItem(item)}
                        onDragEnd={() => { setDraggingHopperItem(null); setHopperDuplicateArmed(null) }}
                        onContextMenu={e => { e.preventDefault(); setHopperDuplicateArmed(prev => prev === item.id ? null : item.id) }}
                        onDoubleClick={() => {
                          const actId = item.id.startsWith('activity:') ? item.id.slice('activity:'.length) : item.activity_id
                          if (actId) openActivityEditor(actId)
                        }}
                        onAutoPlace={(overrides, force) => handleAutoPlace(item.id, overrides, force)}
                        onCommitToday={() => commitToToday(item.id)}
                        dragging={draggingHopperItem?.id === item.id}
                        armed={hopperDuplicateArmed === item.id}
                        isExiting={exitingHopperIds.has(item.id)}
                        isReturning={returningHopperIds.has(item.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Skipped this week — collapsed by default */}
                {weekDismissed.length > 0 && (
                  <SkippedSection weekDismissed={weekDismissed} onRevive={reviveHopperItem} onOpenActivity={openActivityEditor} />
                )}
              </div>

              {/* Quick capture moved into scrollable area above CARRIED OVER */}
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
                      padding: '4px 4px',
                      textAlign: 'center',
                      borderLeft: i === 0 ? 'none' : '1px solid #F0EDE8',
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#C4725A' : '#5A5650',
                    }}>
                      {DAY_LABELS[i]} {d.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Day Spans area */}
            {(() => {
              const rangeStart = dateStr(weekStart)
              const rangeEnd = dateStr(addDays(weekStart, 6))
              const visibleSpans = daySpans.filter(
                s => s.start_date <= rangeEnd && s.end_date >= rangeStart
              )
              const displaySpans = visibleSpans.slice(0, 3)
              const extraCount = visibleSpans.length - 3

              if (visibleSpans.length === 0 && !editingSpan) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '2px 16px 2px 48px', background: '#FAFAF7', borderBottom: '1px solid #F0EDE8' }}>
                    <button
                      onClick={() => setEditingSpan('new')}
                      style={{ fontSize: 11, color: '#8A857D', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >+ Add span</button>
                  </div>
                )
              }

              return (
                <div style={{ background: '#FAFAF7', borderBottom: '1px solid #F0EDE8', padding: '4px 0', position: 'relative' }}>
                  {displaySpans.map(span => {
                    const spanColor = span.color || DEFAULT_SPAN_COLOR
                    // Compute which columns this span covers
                    const clampedStart = span.start_date < rangeStart ? rangeStart : span.start_date
                    const clampedEnd = span.end_date > rangeEnd ? rangeEnd : span.end_date
                    // Map dates to column indices (0=Mon ... 6=Sun)
                    const startCol = Math.max(0, Math.floor((new Date(clampedStart).getTime() - new Date(rangeStart).getTime()) / 86400000))
                    const endCol = Math.min(6, Math.floor((new Date(clampedEnd).getTime() - new Date(rangeStart).getTime()) / 86400000))
                    const colSpan = endCol - startCol + 1
                    // Position as percentage of the 7-column area (offset by 48px hour label)
                    const leftPct = (startCol / 7) * 100
                    const widthPct = (colSpan / 7) * 100

                    return (
                      <div
                        key={span.id}
                        onClick={() => setEditingSpan(span)}
                        style={{
                          height: 24,
                          marginLeft: 48,
                          position: 'relative',
                          marginBottom: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          height: 24,
                          background: `${spanColor}33`,
                          borderLeft: `3px solid ${spanColor}`,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          overflow: 'hidden',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${spanColor}4D`)}
                        onMouseLeave={e => (e.currentTarget.style.background = `${spanColor}33`)}
                        >
                          <span style={{ fontSize: 12, color: '#2D2A26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {span.name}
                            {span.person?.name && <span style={{ color: '#8A857D', marginLeft: 4 }}>· {span.person.name}</span>}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {extraCount > 0 && (
                    <div style={{ marginLeft: 48, fontSize: 11, color: '#8A857D', padding: '0 8px 2px' }}>+{extraCount} more</div>
                  )}
                  <div style={{ marginLeft: 48, padding: '0 8px' }}>
                    <button
                      onClick={() => setEditingSpan('new')}
                      style={{ fontSize: 11, color: '#8A857D', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                    >+ Add span</button>
                  </div>
                </div>
              )
            })()}

            {/* Span Edit Popover */}
            {editingSpan && (() => {
              const isNew = editingSpan === 'new'
              const rangeStart = dateStr(weekStart)
              const rangeEnd = dateStr(addDays(weekStart, 6))
              const initial: DaySpanLocal = isNew
                ? { id: '', name: '', start_date: rangeStart, end_date: rangeEnd, person_id: null, note: null, color: null, value_links: [] }
                : editingSpan
              return <SpanEditPopover
                span={initial}
                values={values}
                knownPeople={knownPeople}
                onSave={saveSpan}
                onDelete={isNew ? undefined : () => deleteSpan(initial.id)}
                onCancel={() => setEditingSpan(null)}
              />
            })()}

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
                  // Use visual duration (accounts for item overflow) for overlap computation
                  const blocksWithVisualDuration = blocks.map(b => ({
                    ...b,
                    duration_minutes: Math.max(b.duration_minutes, (b.items.filter(i => i.name.trim().toLowerCase() !== b.label.trim().toLowerCase()).length * 22 + 24) / (HOUR_HEIGHT / 60)),
                  }))
                  const overlapLayout = computeOverlapLayout(blocksWithVisualDuration)
                  const blockLabels = blocks.map(b => b.label.trim().toLowerCase())
                  // Collect calendar_event_ids from action items linked to blocks on this day
                  const scheduledEventIds = new Set(
                    blocks.flatMap(b => b.items
                      .map(i => (i.metadata as Record<string, unknown> | null)?.calendar_event_id)
                      .filter(Boolean) as string[])
                  )
                  const dayCalEvents = calEvents.filter(ev => {
                    if (ev.is_all_day) return false
                    if (ev.classification?.classification === 'hidden') return false
                    if (ev.classification?.classification === 'fixed_commitment') return false
                    if (ev.classification?.classification === 'flexible_commitment') return false
                    const local = new Date(ev.start_time)
                    const evDate = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
                    if (evDate !== ds) return false
                    // Skip if this event was scheduled as an action item (by event ID)
                    if (scheduledEventIds.has(ev.external_event_id)) return false
                    // Skip if a Wild Success block has a matching name (fuzzy: contains match)
                    const evTitle = (ev.classification?.display_label ?? ev.title).trim().toLowerCase()
                    if (blockLabels.some(label => label.includes(evTitle) || evTitle.includes(label))) return false
                    return true
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
                          ? (placeholderBt.name === 'Desk' ? focusMinutes : placeholderBt.default_duration_minutes)
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
                            const adjustedY = draggingBlock ? clientY - dragOffsetYRef.current : clientY
                            setDragOverTime(getTimeFromClientY(adjustedY))
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
                          const snapTime = getTimeFromClientY(e.clientY - dragOffsetYRef.current)
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

                      {/* Current time indicator — uses WS timezone, renders client-only */}
                      {isToday && nowMinutes !== null && nowMinutes >= GRID_START * 60 && nowMinutes <= GRID_END * 60 && (
                        <div style={{
                          position: 'absolute',
                          top: (nowMinutes - GRID_START * 60) * (HOUR_HEIGHT / 60),
                          left: 0,
                          right: 0,
                          height: 2,
                          background: '#C4725A',
                          zIndex: 5,
                          pointerEvents: 'none',
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4725A', position: 'absolute', left: -3, top: -2 }} />
                        </div>
                      )}

                      {/* Calendar event info bands — subtle, clickable to reclassify */}
                      {dayCalEvents
                        .filter(ev => ev.classification?.classification === 'info')
                        .map(calEv => {
                          const startT = localTimeStr(calEv.start_time)
                          const endT = localTimeStr(calEv.end_time)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                zIndex: 0,
                                pointerEvents: 'none',
                                top: blockTopPx(startT),
                                height: blockHeightPx(dur),
                                background: '#4B82AF08',
                                borderLeft: '2px solid #4B82AF20',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                overflow: 'hidden',
                              }}
                            >
                              <span onClick={() => openClassifyDialog(calEv)} style={{ fontSize: 8, color: '#4B82AF80', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, pointerEvents: 'auto', cursor: 'pointer' }}>
                                {calEv.display_label ?? calEv.title}
                              </span>
                              <button onClick={e => { e.stopPropagation(); hideCalEvent(calEv) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#4B82AF60', padding: '1px 3px', lineHeight: 1, flexShrink: 0, pointerEvents: 'auto' }} title="Hide event">×</button>
                            </div>
                          )
                        })
                      }

                      {/* Calendar event provisional — unclassified, needs attention */}
                      {dayCalEvents
                        .filter(ev => !ev.classification || ev.classification.classification === 'provisional')
                        .map(calEv => {
                          const startT = localTimeStr(calEv.start_time)
                          const endT = localTimeStr(calEv.end_time)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              style={{
                                position: 'absolute',
                                left: 2,
                                right: 2,
                                zIndex: 0,
                                pointerEvents: 'none',
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
                              <span onClick={() => openClassifyDialog(calEv)} style={{ fontSize: 9, background: '#C4725A', color: 'white', borderRadius: 3, padding: '1px 4px', fontWeight: 700, flexShrink: 0, marginTop: 1, pointerEvents: 'auto', cursor: 'pointer' }}>?</span>
                              <span onClick={() => openClassifyDialog(calEv)} style={{ fontSize: 9, color: '#2D2A26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, pointerEvents: 'auto', cursor: 'pointer' }}>{calEv.title}</span>
                              <button onClick={e => { e.stopPropagation(); hideCalEvent(calEv) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#C4725A80', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginTop: 1, pointerEvents: 'auto' }} title="Hide event">×</button>
                            </div>
                          )
                        })
                      }

                      {/* Calendar event fixed_commitment — hard block, non-interactive container */}
                      {dayCalEvents
                        .filter(ev => ev.classification?.classification === 'fixed_commitment')
                        .map(calEv => {
                          const startT = localTimeStr(calEv.start_time)
                          const endT = localTimeStr(calEv.end_time)
                          const dur = timeToMinutes(endT) - timeToMinutes(startT)
                          return (
                            <div
                              key={calEv.id}
                              style={{
                                position: 'absolute',
                                left: 2,
                                right: 2,
                                zIndex: 0,
                                pointerEvents: 'none',
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
                              <span onClick={() => openClassifyDialog(calEv)} style={{ fontSize: 8, color: '#9E6A46', flexShrink: 0, pointerEvents: 'auto', cursor: 'pointer' }}>🔒</span>
                              <span onClick={() => openClassifyDialog(calEv)} style={{ fontSize: 9, color: '#9E6A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, pointerEvents: 'auto', cursor: 'pointer' }}>
                                {calEv.display_label ?? calEv.title}
                              </span>
                              <button onClick={e => { e.stopPropagation(); hideCalEvent(calEv) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#9E6A4660', padding: '0 2px', lineHeight: 1, flexShrink: 0, pointerEvents: 'auto' }} title="Hide event">×</button>
                            </div>
                          )
                        })
                      }

                      {/* Time blocks */}
                      {blocks.map(block => {
                        const isOver = dragOverBlockId === block.id
                        const blockColor = block.block_type?.color ?? '#4B82AF'
                        return (
                          <div
                            key={block.id}
                            draggable
                            onContextMenu={e => { e.preventDefault(); setDuplicateArmed(prev => prev === block.id ? null : block.id) }}
                            onDragStart={e => {
                              e.stopPropagation()
                              setBlockTooltip(null)
                              // Transparent drag image — rely on the placeholder rectangle instead
                              const img = new Image()
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
                              e.dataTransfer.setDragImage(img, 0, 0)
                              // Capture cursor offset within block so drop aligns to block top
                              const blockEl = e.currentTarget as HTMLElement
                              dragOffsetYRef.current = e.clientY - blockEl.getBoundingClientRect().top
                              const isDuplicate = duplicateArmed === block.id
                              setDraggingBlock({ block, date: ds, isDuplicate })
                              setDuplicateArmed(null)
                            }}
                            onDragEnd={() => { setDraggingBlock(null); setDuplicateArmed(null) }}
                            onMouseEnter={e => { if (!draggingBlock && !draggingBlockTypeId && !draggingHopperItem) setBlockTooltip({ label: block.label, time: `${formatTime12(block.start_time)} · ${block.duration_minutes}m`, x: e.clientX, y: e.clientY }) }}
                            onMouseMove={e => { if (draggingBlock || draggingBlockTypeId || draggingHopperItem) { setBlockTooltip(null); return } setBlockTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null) }}
                            onMouseLeave={() => setBlockTooltip(null)}
                            style={(() => {
                              const ol = overlapLayout.get(block.id)
                              const col = ol?.col ?? 0
                              const totalCols = ol?.totalCols ?? 1
                              // Height: max of time-based height and content-needed height
                              // Only count extra items (not matching block label) since the primary merges into header
                              const timeHeight = blockHeightPx(block.duration_minutes)
                              const labelLower = block.label.trim().toLowerCase()
                              const extraCount = block.items.filter(i => i.name.trim().toLowerCase() !== labelLower).length
                              const contentHeight = 24 + extraCount * 22
                              return {
                              position: 'absolute' as const,
                              top: blockTopPx(block.start_time),
                              // During resize, use time-based height only (skip content expansion)
                              height: resizing?.blockId === block.id ? timeHeight : Math.max(timeHeight, contentHeight),
                              left: `calc(${(col / totalCols) * 100}% + 2px)`,
                              width: `calc(${100 / totalCols}% - 4px)`,
                              borderRadius: 8,
                              background: isOver ? blockColor + '15' : blockColor + '12',
                              border: `1.5px solid ${isOver ? blockColor : blockColor + '40'}`,
                              overflow: 'hidden',
                              zIndex: 1,
                              opacity: (draggingBlock?.block.id === block.id && !draggingBlock.isDuplicate) ? 0.4 : 1,
                              cursor: 'grab',
                              outline: duplicateArmed === block.id ? `2px dashed ${blockColor}` : 'none',
                              outlineOffset: 2,
                              animation: exitingBlockIds.has(block.id) ? 'block-exit 260ms ease-out forwards' : newlyPlacedIds.has(block.id) ? 'auto-place-pulse 2s ease-out' : undefined,
                            }})()}
                            onDragOver={e => {
                              e.preventDefault()
                              if (draggingHopperItem) setDragOverBlockId(block.id)
                            }}
                            onDragLeave={() => { if (dragOverBlockId === block.id) setDragOverBlockId(null) }}
                            onDrop={e => {
                              e.preventDefault()
                              if (draggingHopperItem) {
                                e.stopPropagation()
                                handleDropOnBlock(block, ds)
                              }
                              // draggingBlock drops bubble up to the column
                            }}
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

                            {/* Block header — if an item matches the label, merge its actions into the header */}
                            {(() => {
                              const blockLabelLower = block.label.trim().toLowerCase()
                              const matchingItems = block.items.filter(i => i.name.trim().toLowerCase() === blockLabelLower)
                              // Prefer the non-completed item as primary (it's the actionable one)
                              const primaryItem = matchingItems.find(i => i.status !== 'completed') ?? matchingItems[0] ?? null
                              const extraItems = block.items.filter(i => i.name.trim().toLowerCase() !== blockLabelLower)
                              const headerCompleted = primaryItem?.status === 'completed'

                              return (
                                <>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 6px',
                                    borderBottom: extraItems.length > 0 ? '1px solid #F0EDE8' : 'none',
                                    background: headerCompleted ? '#5A9E6F08' : 'transparent',
                                  }}>
                                    <div style={{ width: 3, height: 14, borderRadius: 2, background: headerCompleted ? '#5A9E6F' : blockColor, flexShrink: 0 }} />
                                    {editingBlockLabel?.blockId === block.id ? (
                                      <input
                                        autoFocus
                                        value={editingBlockLabel.label}
                                        onChange={e => setEditingBlockLabel(prev => prev ? { ...prev, label: e.target.value } : null)}
                                        onBlur={() => renameBlock(block.id, ds, editingBlockLabel.label)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') renameBlock(block.id, ds, editingBlockLabel.label)
                                          if (e.key === 'Escape') setEditingBlockLabel(null)
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        style={{ fontSize: 10, fontWeight: 600, color: '#2D2A26', flex: 1, border: '1px solid #E0DDD6', borderRadius: 3, padding: '1px 4px', background: '#FFF', outline: 'none', minWidth: 0 }}
                                      />
                                    ) : (
                                      <span
                                        onDoubleClick={e => { e.stopPropagation(); setEditingBlockLabel({ blockId: block.id, date: ds, label: block.label }) }}
                                        style={{
                                          fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text',
                                          color: headerCompleted ? '#5A9E6F' : '#2D2A26',
                                          textDecoration: headerCompleted ? 'line-through' : 'none',
                                        }}
                                      >
                                        {block.block_type?.icon && <span style={{ marginRight: 3 }}>{block.block_type.icon}</span>}
                                        {block.label}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 9, color: '#8A857D', flexShrink: 0 }}>{formatTime12(block.start_time)}</span>
                                    {primaryItem && primaryItem.status !== 'completed' && (
                                      <button
                                        onClick={() => markItemComplete(primaryItem, block, ds)}
                                        style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid #8A857D', background: 'transparent', cursor: 'pointer', fontSize: 7, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                        title="Mark complete"
                                      >✓</button>
                                    )}
                                    {primaryItem && (
                                      <button
                                        onClick={() => returnToHopper(primaryItem, block, ds)}
                                        style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid #8A857D', background: 'transparent', cursor: 'pointer', fontSize: 7, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                        title="Return to hopper"
                                      >←</button>
                                    )}
                                    <button
                                      onClick={() => deleteBlock(block.id, ds)}
                                      style={{
                                        width: 12, height: 12, borderRadius: 3, border: 'none', background: 'transparent',
                                        cursor: 'pointer', fontSize: 9, color: '#8A857D', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', padding: 0, lineHeight: 1, flexShrink: 0,
                                      }}
                                      title="Delete block"
                                    >×</button>
                                  </div>

                                  {/* Extra items (names that don't match the block label) */}
                                  {extraItems.map(item => (
                                    <div
                                      key={item.id}
                                      style={{
                                        padding: '3px 6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        borderBottom: '1px solid #F5F3EF',
                                        background: flashingItemIds.has(item.id) ? 'transparent' : item.status === 'completed' ? '#5A9E6F08' : 'transparent',
                                        animation: flashingItemIds.has(item.id) ? 'item-complete-flash 0.9s ease-out forwards' : undefined,
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
                                </>
                              )
                            })()}

                            {/* Drop placeholder */}
                            {isOver && draggingHopperItem && (
                              <div style={{ padding: '3px 6px', background: '#4B82AF08', borderBottom: '1px dashed #4B82AF30', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: EC[draggingHopperItem.time_type], flexShrink: 0 }} />
                                <span style={{ fontSize: 9, color: '#4B82AF80', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {draggingHopperItem.name}
                                </span>
                              </div>
                            )}

                            {/* Resize handle */}
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
                          </div>
                        )
                      })}

                      {/* Floating schedule items (auto-placed, no time block) */}
                      {(floatingItems[ds] ?? [])
                        .filter(fi => {
                          // Skip floating items whose time overlaps with an existing block's item
                          return !blocks.some(b => b.items.some(bi => bi.id === fi.id))
                        })
                        .map(fi => {
                        const startMin = timeToMinutes(fi.scheduled_time)
                        const endMin = fi.scheduled_end_time ? timeToMinutes(fi.scheduled_end_time) : startMin + 45
                        const dur = endMin - startMin
                        return (
                          <div
                            key={fi.id}
                            style={{
                              position: 'absolute',
                              top: blockTopPx(fi.scheduled_time),
                              height: blockHeightPx(dur),
                              left: 2,
                              right: 2,
                              zIndex: 0,
                              borderRadius: 6,
                              border: `1.5px solid ${EC[fi.time_type] ?? '#B5B0A8'}80`,
                              background: `${EC[fi.time_type] ?? '#B5B0A8'}14`,
                              padding: '3px 6px',
                              overflow: 'hidden',
                              cursor: 'default',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: EC[fi.time_type] ?? '#5A5650', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {fi.name}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteFloatingItem(fi) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: '#8A857D', lineHeight: 1, flexShrink: 0 }}
                                title="Remove and return to hopper"
                              >×</button>
                            </div>
                            <div style={{ fontSize: 9, color: '#8A857D', marginTop: 1 }}>
                              {formatTime12(fi.scheduled_time)}
                            </div>
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
                      {(() => {
                        // Compute Open hours from waking time minus total block duration
                        const totalBlockMin = Object.values(dayBlocks).flat().reduce((s, b) => s + b.duration_minutes, 0)
                        const totalWakingMin = 7 * 16 * 60 // 16 waking hours × 7 days
                        const openMin = Math.max(0, totalWakingMin - totalBlockMin)
                        const openHours = Math.round(openMin / 60)
                        const totalItems = allScheduledItems.length

                        return (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {(['A', 'B', 'C', 'D'] as const).map(level => (
                                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: EC[level], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#FFF', fontWeight: 700, flexShrink: 0 }}>
                                    {level}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#8A857D', minWidth: 48 }}>{EL[level]}</span>
                                  <div style={{ flex: 1, height: 6, background: '#E8E4DC', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${totalItems > 0 ? ((energyCounts[level] ?? 0) / totalItems) * 100 : 0}%`,
                                      background: EC[level],
                                      borderRadius: 3,
                                    }} />
                                  </div>
                                  <span style={{ fontSize: 10, color: '#8A857D', minWidth: 16, textAlign: 'right' }}>{energyCounts[level] ?? 0}</span>
                                </div>
                              ))}
                              {/* Open — computed from waking hours minus blocks */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: EC['0'], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#5A5650', fontWeight: 700, flexShrink: 0 }}>
                                  0
                                </span>
                                <span style={{ fontSize: 9, color: '#8A857D', minWidth: 48 }}>{EL['0']}</span>
                                <div style={{ flex: 1, height: 6, background: '#E8E4DC', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${(openMin / totalWakingMin) * 100}%`,
                                    background: EC['0'],
                                    borderRadius: 3,
                                  }} />
                                </div>
                                <span style={{ fontSize: 10, color: '#8A857D', minWidth: 16, textAlign: 'right' }}>{openHours}h</span>
                              </div>
                            </div>
                            {/* Warnings */}
                            {totalItems > 0 && (() => {
                              const warnings: string[] = []
                              if ((energyCounts['D'] ?? 0) === 0) warnings.push('No restore time scheduled.')
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
                          </>
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
      {classifying && (() => {
        const OPTS: { value: 'info' | 'fixed_commitment' | 'flexible_commitment'; icon: string; label: string; desc: string; color: string }[] = [
          { value: 'fixed_commitment', icon: '✓', label: 'Schedule It', desc: 'Creates a scheduled item at this time on your calendar', color: '#5A9E6F' },
          { value: 'info', icon: '○', label: 'Leave as Background', desc: 'Just context — barely visible, won\'t affect scheduling', color: '#4B82AF' },
          { value: 'flexible_commitment', icon: '→', label: 'Add to Hopper', desc: 'Turns into a task you can drag to any slot', color: '#8A857D' },
        ]
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(45,42,38,0.2)' }}
            onClick={e => { if (e.target === e.currentTarget) setClassifying(null) }}
          >
            <div style={{ background: '#FAFAF7', borderRadius: 14, padding: 24, width: 350, boxShadow: '0 8px 32px rgba(45,42,38,0.2)', fontFamily: '"Source Sans 3", sans-serif' }}>

              {/* Header */}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Google Calendar Event</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2D2A26', marginBottom: 4 }}>{classifying.event.title}</div>
              <div style={{ fontSize: 11, color: '#8A857D', marginBottom: 16 }}>
                {(() => {
                  const d = new Date(classifying.event.start_time)
                  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                })()}
              </div>

              {/* Display label (compact) */}
              <input
                value={classifying.displayLabel}
                onChange={e => setClassifying(s => s ? { ...s, displayLabel: e.target.value } : s)}
                placeholder="Display label (optional)"
                style={{ width: '100%', fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 8, padding: '6px 10px', background: '#FFF', color: '#2D2A26', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }}
              />

              {/* Classification cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {OPTS.map(opt => {
                  const sel = !classifying.hiding && classifying.classification === opt.value
                  return (
                    <div
                      key={opt.value}
                      onClick={() => setClassifying(s => s ? { ...s, classification: opt.value, hiding: false } : s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                        border: `1.5px solid ${sel ? opt.color + '60' : '#E8E4DC'}`,
                        background: sel ? opt.color + '0C' : '#FFF',
                        transition: 'all 0.1s',
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center', color: opt.color }}>{opt.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? opt.color : '#2D2A26' }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: '#8A857D' }}>{opt.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Energy level — only for non-info */}
              {!classifying.hiding && classifying.classification !== 'info' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Energy type</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['A', 'B', 'C', 'D', '0'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setClassifying(s => s ? { ...s, energyLevel: level } : s)}
                        style={{
                          flex: 1, padding: '4px', borderRadius: 6,
                          border: `1.5px solid ${classifying.energyLevel === level ? EC[level] : '#E0DDD6'}`,
                          background: classifying.energyLevel === level ? EC[level] + '15' : '#FFF',
                          cursor: 'pointer', fontSize: 10, fontWeight: 500,
                          color: classifying.energyLevel === level ? EC[level] : '#8A857D',
                        }}
                      >{EL[level]}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply to series */}
              {classifying.event.external_series_id && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: '#5A5650' }}>
                    <input type="checkbox" checked={classifying.applyToSeries} onChange={e => setClassifying(s => s ? { ...s, applyToSeries: e.target.checked } : s)} />
                    Apply to all instances of this recurring event
                  </label>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setClassifying(s => s ? { ...s, hiding: true } : s)}
                  title="Remove this event from Wild Success view"
                  style={{ fontSize: 11, color: '#B5B0A8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: classifying.hiding ? 'none' : 'none', fontFamily: 'inherit',
                    ...(classifying.hiding ? { color: '#C4504A', fontWeight: 600 } : {}),
                  }}
                >
                  {classifying.hiding ? '✕ Will hide this event' : 'Hide from Wild Success'}
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => setClassifying(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E0DDD6', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#5A5650', fontFamily: 'inherit' }}>Cancel</button>
                <button
                  onClick={saveClassification}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: classifying.hiding ? '#C4504A' : '#2D2A26', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#FFF', fontFamily: 'inherit' }}
                >{classifying.hiding ? 'Hide' : 'Confirm'}</button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Activity Editor Modal ────────────────────────────────────────────── */}
      {editingActivityId && (editingActivityId === 'new' || editingActivityFull) && (() => {
        return (
          <EditActivityModal
            activity={editingActivityId === 'new' ? null : editingActivityFull}
            defaultName={editingActivityId === 'new' ? editingActivityPrefillName : undefined}
            values={values ?? []}
            domains={domains ?? []}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            outcomes={outcomes as any}
            onSave={handleSaveActivity}
            onDelete={null}
            onClose={() => { setEditingActivityId(null); setEditingActivityPrefillName(''); setEditingActivityFull(null) }}
          />
        )
      })()}
    </div>
    {blockTooltip && (
      <div style={{
        position: 'fixed',
        left: blockTooltip.x / 1.2 + 12,
        top: blockTooltip.y / 1.2 - 8,
        background: '#2D2A26',
        color: '#FAF9F6',
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 12,
        pointerEvents: 'none',
        zIndex: 9999,
        maxWidth: 280,
        whiteSpace: 'normal',
        lineHeight: 1.4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontWeight: 600 }}>{blockTooltip.label}</div>
        <div style={{ fontSize: 10, color: '#B5B0A8', marginTop: 2 }}>{blockTooltip.time}</div>
      </div>
    )}
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  template_proposal: '#7A9E82',
  outside_request: '#C4725A',
  quick_capture: '#4B82AF',
  planning_function: '#9E6A82',
}

function SkippedSection({ weekDismissed, onRevive, onOpenActivity }: {
  weekDismissed: CandidateItemLocal[]
  onRevive: (item: CandidateItemLocal) => void
  onOpenActivity: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ marginBottom: 8, marginTop: 4 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          fontSize: 9, fontWeight: 700, color: '#D0CBC3', letterSpacing: 1, marginBottom: 4, paddingLeft: 4,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        SKIPPED ({weekDismissed.length})
      </button>
      {expanded && weekDismissed.map(item => (
        <HopperItemCard
          key={item.id}
          item={item}
          onDismiss={() => {}}
          onRevive={() => onRevive(item)}
          onDragStart={() => {}}
          onDragEnd={() => {}}
          onContextMenu={e => e.preventDefault()}
          onDoubleClick={() => item.activity_id ? onOpenActivity(item.activity_id) : undefined}
          dragging={false}
          muted
        />
      ))}
    </div>
  )
}

interface HopperItemCardProps {
  item: CandidateItemLocal
  onDismiss: () => void
  onRevive?: () => void
  onLog?: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onMakeActivity?: () => void
  onAutoPlace?: (overrides?: { preferred_time: string; duration_minutes: number }, force?: boolean) => void
  onTimeShift?: (date: string) => void
  onDelete?: () => void
  onCommitToday?: () => void
  outcomes?: { id: string; name: string }[]
  isVirtual?: boolean
  dragging: boolean
  armed?: boolean
  muted?: boolean
  isExiting?: boolean
  isReturning?: boolean
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Biweekly',
  monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}

const LATER_OPTIONS = [
  { label: 'Next week', getDate: () => {
    const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day))
    return d.toISOString().split('T')[0]
  }},
  { label: '2 weeks', getDate: () => {
    const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 8 : 15 - day))
    return d.toISOString().split('T')[0]
  }},
  { label: 'Next month', getDate: () => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1)
    return d.toISOString().split('T')[0]
  }},
]
const TIME_OPTIONS = ['morning', 'afternoon', 'evening'] as const
const TIME_LABELS: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
const DUR_OPTIONS = [15, 30, 45, 60, 90]

const HopperItemCard = memo(function HopperItemCard({ item, onDismiss, onRevive, onLog, onDragStart, onDragEnd, onContextMenu, onDoubleClick, onMakeActivity, onAutoPlace, onTimeShift, onDelete, onCommitToday, outcomes, isVirtual, dragging, armed, muted, isExiting, isReturning }: HopperItemCardProps) {
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showLaterMenu, setShowLaterMenu] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [formTime, setFormTime] = useState<string>(() => item.preferred_time ?? 'morning')
  const [formDur, setFormDur] = useState<number>(() => {
    if (item.duration_min && item.duration_min > 0) {
      return DUR_OPTIONS.reduce((prev, cur) => Math.abs(cur - item.duration_min) < Math.abs(prev - item.duration_min) ? cur : prev)
    }
    return 30
  })

  const leftBorderColor: Record<string, string> = { urgent: '#C4725A', normal: '#D0CBC3', suggested: '#7BAF7B' }
  const bgColor: Record<string, string> = { urgent: '#FDF8F5', normal: '#FFFFFF', suggested: '#FFFFFF' }

  function handleScheduleConfirm(e: React.MouseEvent, force = false) {
    e.stopPropagation()
    onAutoPlace?.({ preferred_time: formTime, duration_minutes: formDur }, force)
    setShowScheduleForm(false)
  }

  const actionLink: React.CSSProperties = { fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }

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
        padding: '5px 8px',
        marginBottom: 3,
        borderRadius: 6,
        border: armed ? '1.5px dashed #4B82AF' : '1px solid #E8E4DC',
        borderLeft: armed ? '3px dashed #4B82AF' : `3px solid ${leftBorderColor[item.priority_tier]}`,
        background: armed ? '#4B82AF08' : bgColor[item.priority_tier],
        cursor: 'grab',
        opacity: dragging ? 0.4 : muted ? 0.7 : 1,
        userSelect: 'none',
        position: 'relative',
        overflow: isExiting ? 'hidden' : undefined,
        animation: isExiting ? 'hopper-dismiss 360ms ease-out forwards' : isReturning ? 'hopper-return 2s ease-out' : undefined,
      }}
    >
      {armed && (
        <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, color: '#4B82AF', fontWeight: 700, lineHeight: 1 }}>✦ drag to place</div>
      )}
      {/* Energy dot */}
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: EC[item.time_type], flexShrink: 0, marginTop: 3 }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: item.priority_tier === 'urgent' ? 600 : 400,
          color: TIER_COLORS[item.priority_tier],
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}>
          {item.name}
          {item.emotional_weight === 'heavy' && <span style={{ color: '#C4725A', marginLeft: 3, fontSize: 8 }}>◆</span>}
        </div>
        {item.big_outcome_id && outcomes && (() => {
          const bo = outcomes.find(o => o.id === item.big_outcome_id)
          return bo ? <div style={{ fontSize: 9, color: '#8A857D', lineHeight: 1.2 }}>↳ {bo.name}</div> : null
        })()}

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
          {onAutoPlace && (
            <button onClick={e => { e.stopPropagation(); setShowScheduleForm(f => !f); setShowLaterMenu(false) }}
              style={{ ...actionLink, color: '#4B82AF', fontWeight: 600 }}>
              Schedule
            </button>
          )}
          {onCommitToday && (
            <button onClick={e => { e.stopPropagation(); onCommitToday() }}
              style={{ ...actionLink, color: '#5A9E6F' }}>
              To-do
            </button>
          )}
          {onTimeShift && !isVirtual && (
            <div style={{ position: 'relative' }}>
              <button onClick={e => { e.stopPropagation(); setShowLaterMenu(l => !l); setShowScheduleForm(false) }}
                style={{ ...actionLink, color: '#8A8578' }}>
                Later…
              </button>
              {showLaterMenu && (
                <>
                  <div onClick={e => { e.stopPropagation(); setShowLaterMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', left: 0, top: '100%', zIndex: 101, marginTop: 2,
                    background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 130, overflow: 'hidden',
                  }}>
                    {LATER_OPTIONS.map(opt => (
                      <button key={opt.label} onClick={() => { setShowLaterMenu(false); onTimeShift(opt.getDate()) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0EDE6', cursor: 'pointer', fontSize: 11, color: '#2D2A26', fontFamily: 'inherit' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {isVirtual && !onRevive && (
            <button onClick={e => { e.stopPropagation(); onDismiss() }}
              style={{ ...actionLink, color: '#B5B0A8' }}>
              Skip
            </button>
          )}
          {onRevive && (
            <button onClick={e => { e.stopPropagation(); onRevive() }}
              style={{ ...actionLink, color: '#8A857D' }}>
              Revive
            </button>
          )}
          {/* Overflow menu for secondary actions */}
          {!onRevive && !isVirtual && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button onClick={e => { e.stopPropagation(); setShowOverflow(o => !o) }}
                style={{ ...actionLink, color: '#C4BFB4', fontSize: 12, padding: '0 2px' }}>
                ···
              </button>
              {showOverflow && (
                <>
                  <div onClick={e => { e.stopPropagation(); setShowOverflow(false) }} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 101, marginTop: 2,
                    background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 140, overflow: 'hidden',
                  }}>
                    {onLog && (
                      <button onClick={() => { setShowOverflow(false); onLog() }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0EDE6', cursor: 'pointer', fontSize: 11, color: '#2D2A26', fontFamily: 'inherit' }}>
                        Log as done
                      </button>
                    )}
                    {onMakeActivity && (
                      <button onClick={() => { setShowOverflow(false); onMakeActivity() }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0EDE6', cursor: 'pointer', fontSize: 11, color: '#2D2A26', fontFamily: 'inherit' }}>
                        Make Activity
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => { setShowOverflow(false); onDelete() }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#C4725A', fontFamily: 'inherit' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Schedule form (inline, expands below) */}
        {showScheduleForm && onAutoPlace && (
          <div onClick={e => e.stopPropagation()} style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              {TIME_OPTIONS.map(t => (
                <button key={t} onClick={() => setFormTime(t)} style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  background: formTime === t ? '#4B82AF' : '#F5F3EF',
                  color: formTime === t ? '#FFF' : '#5A5650',
                  border: `1px solid ${formTime === t ? '#4B82AF' : 'transparent'}`,
                  fontWeight: formTime === t ? 600 : 400,
                }}>{TIME_LABELS[t]}</button>
              ))}
              <input type="text" placeholder="HH:MM"
                value={TIME_OPTIONS.includes(formTime as typeof TIME_OPTIONS[number]) ? '' : formTime}
                onChange={e => setFormTime(e.target.value)}
                style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 10, width: 52,
                  border: `1px solid ${!TIME_OPTIONS.includes(formTime as typeof TIME_OPTIONS[number]) && formTime ? '#4B82AF' : '#E0DDD6'}`,
                  background: !TIME_OPTIONS.includes(formTime as typeof TIME_OPTIONS[number]) && formTime ? '#4B82AF12' : '#F5F3EF',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {DUR_OPTIONS.map(d => (
                <button key={d} onClick={() => setFormDur(d)} style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  background: formDur === d ? '#4B82AF' : '#F5F3EF',
                  color: formDur === d ? '#FFF' : '#5A5650',
                  border: `1px solid ${formDur === d ? '#4B82AF' : 'transparent'}`,
                  fontWeight: formDur === d ? 600 : 400,
                }}>{d}m</button>
              ))}
              <button onClick={handleScheduleConfirm} style={{
                marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 9px', borderRadius: 10,
                background: '#5A9E6F', color: '#FFF', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>Go →</button>
              <button onClick={e => handleScheduleConfirm(e, true)} title="Place at this exact time, ignoring calendar conflicts" style={{
                fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 10,
                background: 'transparent', color: '#B5B0A8', border: '1px solid #E0DDD6', cursor: 'pointer', fontFamily: 'inherit',
              }}>Force</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

// ── SpanEditPopover ──────────────────────────────────────────────────────────
const SpanEditPopover = memo(function SpanEditPopover({
  span: initial,
  values,
  knownPeople,
  onSave,
  onDelete,
  onCancel,
}: {
  span: DaySpanLocal
  values: { id: string; name: string }[]
  knownPeople: KnownPersonLocal[]
  onSave: (span: DaySpanLocal) => void
  onDelete?: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [startDate, setStartDate] = useState(initial.start_date)
  const [endDate, setEndDate] = useState(initial.end_date)
  const [personId, setPersonId] = useState(initial.person_id || '')
  const [color, setColor] = useState(initial.color || '')
  const [note, setNote] = useState(initial.note || '')
  const [valueLinks, setValueLinks] = useState<{ value_id: string; contribution_strength: 'weak' | 'moderate' | 'strong' }[]>(
    initial.value_links.map(vl => ({ value_id: vl.value_id, contribution_strength: vl.contribution_strength }))
  )

  function toggleValue(valueId: string) {
    setValueLinks(prev => {
      const existing = prev.find(vl => vl.value_id === valueId)
      if (existing) return prev.filter(vl => vl.value_id !== valueId)
      return [...prev, { value_id: valueId, contribution_strength: 'moderate' as const }]
    })
  }

  function setStrength(valueId: string, strength: 'weak' | 'moderate' | 'strong') {
    setValueLinks(prev => prev.map(vl => vl.value_id === valueId ? { ...vl, contribution_strength: strength } : vl))
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({
      ...initial,
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      person_id: personId || null,
      color: color || null,
      note: note || null,
      value_links: valueLinks.map(vl => ({ id: '', value_id: vl.value_id, contribution_strength: vl.contribution_strength })),
    })
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      width: 320,
      background: '#FAFAF7',
      border: '1px solid #E0DDD6',
      borderRadius: 4,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Span name"
        autoFocus
        style={{ fontSize: 14, fontWeight: 600, border: '1px solid #E0DDD6', borderRadius: 4, padding: '6px 8px', background: '#FFF', color: '#2D2A26', width: '100%', boxSizing: 'border-box' }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 2 }}>Start</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '4px 6px', background: '#FFF', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 2 }}>End</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '4px 6px', background: '#FFF', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {knownPeople.length > 0 && (
        <div>
          <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 2 }}>Person</label>
          <select
            value={personId}
            onChange={e => setPersonId(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '4px 6px', background: '#FFF', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">None</option>
            {knownPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 4 }}>Values</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {values.map(v => {
            const link = valueLinks.find(vl => vl.value_id === v.id)
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!link}
                  onChange={() => toggleValue(v.id)}
                  style={{ margin: 0 }}
                />
                <span style={{ fontSize: 12, color: '#2D2A26', flex: 1 }}>{v.name}</span>
                {link && (
                  <select
                    value={link.contribution_strength}
                    onChange={e => setStrength(v.id, e.target.value as 'weak' | 'moderate' | 'strong')}
                    style={{ fontSize: 10, border: '1px solid #E0DDD6', borderRadius: 3, padding: '1px 3px', background: '#FFF' }}
                  >
                    <option value="weak">Weak</option>
                    <option value="moderate">Moderate</option>
                    <option value="strong">Strong</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 4 }}>Color</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {SPAN_COLORS.map(c => (
            <div
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                background: c,
                cursor: 'pointer',
                border: color === c ? '2px solid #2D2A26' : '1px solid #D5D0C8',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, color: '#8A857D', display: 'block', marginBottom: 2 }}>Note</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note"
          style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 4, padding: '4px 6px', background: '#FFF', width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{ fontSize: 12, color: '#C4725A', background: 'none', border: '1px solid #C4725A40', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', marginRight: 'auto' }}
          >Delete</button>
        )}
        <button
          onClick={onCancel}
          style={{ fontSize: 12, color: '#8A857D', background: 'none', border: '1px solid #E0DDD6', borderRadius: 4, padding: '5px 12px', cursor: 'pointer' }}
        >Cancel</button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          style={{ fontSize: 12, color: '#FFF', background: name.trim() ? '#2D2A26' : '#B5B0A8', border: 'none', borderRadius: 4, padding: '5px 14px', cursor: name.trim() ? 'pointer' : 'default' }}
        >Save</button>
      </div>
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
