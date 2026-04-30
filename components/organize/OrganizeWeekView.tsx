'use client'
import { useState, useEffect, useCallback } from 'react'
import { ActionItem, TimeBlock, UserValue, LifeDomain, Activity } from '@/lib/types'
import { COLORS } from '@/lib/theme'

// ── Constants ──────────────────────────────────────────────────────────────────
const EC: Record<string, string> = { A: COLORS.primary, B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Connection', D: 'Restore', '0': 'Open' }
const SL: Record<string, string> = { template_proposal: 'Suggested', outside_request: 'Request', quick_capture: 'Captured', planning_function: 'From Plan' }
const SI: Record<string, string> = { template_proposal: '◈', outside_request: '↗', quick_capture: '✎', planning_function: '◎' }
const WI: Record<string, string> = { light: '', normal: '', heavy: '◆' }
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Local types ────────────────────────────────────────────────────────────────
interface LocalItem {
  localId: string
  actionItemId?: string
  activityId?: string
  name: string
  source: string
  energyLevel: 'A' | 'B' | 'C' | 'D' | '0'
  emotionalWeight: 'light' | 'normal' | 'heavy'
  durationMin: number
  durationMax: number
  flexibility: string
  values: string[]
  isHard?: boolean
  scheduledTime?: string
  endTime?: string
  meta?: { requestedBy?: string; note?: string }
}

interface LocalBlock {
  localId: string
  dbId?: string
  label: string
  start: string
  end: string
  rawStartTime?: string | null
  rawEndTime?: string | null
  energyLevel: 'A' | 'B' | 'C' | 'D' | '0'
  isHardBlock?: boolean
  items: LocalItem[]
}

interface CompletedItem {
  id: string
  name: string
  dateStr: string
  dayLabel: string
  energyLevel: string
  values: string[]
}

interface Props {
  onClose: () => void
  onSwitchToDay: () => void
  onEditTemplate: () => void
  values: UserValue[]
  domains: LifeDomain[]
  activities: Activity[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day // Mon=1
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + n)
  return dt
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '?'
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`
}

function todayStr(): string {
  return dateStr(new Date())
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function OrganizeWeekView({ onClose, onSwitchToDay, onEditTemplate, values, domains: _domains, activities }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [dayBlocks, setDayBlocks] = useState<Record<string, LocalBlock[]>>({})
  const [committedItems, setCommittedItems] = useState<Record<string, LocalItem[]>>({})
  const [hopper, setHopper] = useState<LocalItem[]>([])
  const [completed, setCompleted] = useState<CompletedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dragItem, setDragItem] = useState<(LocalItem & { fromSection: string }) | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [hopperFilter, setHopperFilter] = useState('all')
  const [rightPanel, setRightPanel] = useState<'summary' | 'completed'>('summary')
  const [captureInput, setCaptureInput] = useState('')
  const [savingCapture, setSavingCapture] = useState(false)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)
  const today = todayStr()

  const weekLabel = (() => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const s = weekStart.toLocaleDateString('en-US', opts)
    const e = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${s} – ${e}`
  })()

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const dates = Array.from({ length: 7 }, (_, i) => dateStr(addDays(weekStart, i)))
    const rangeStart = dates[0]
    const rangeEnd = dates[6]

    // Seed defaults then generate blocks for all 7 days
    await fetch('/api/time-template/seed-defaults', { method: 'POST' }).catch(() => {})
    await Promise.all(dates.map(d =>
      fetch('/api/time-blocks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: d }),
      }).catch(() => {})
    ))

    const [blocksRes, schedRes, hopperRes, completedRes] = await Promise.all([
      fetch(`/api/time-blocks?range_start=${rangeStart}&range_end=${rangeEnd}`).catch(() => null),
      fetch(`/api/action-items?range_start=${rangeStart}&range_end=${rangeEnd}`).catch(() => null),
      fetch('/api/action-items?status=candidate').catch(() => null),
      fetch(`/api/action-log?event_type=completed&range_start=${rangeStart}&range_end=${rangeEnd}`).catch(() => null),
    ])

    const [blocksData, schedData, hopperData, completedData] = await Promise.all([
      blocksRes?.ok ? blocksRes.json() : [],
      schedRes?.ok ? schedRes.json() : [],
      hopperRes?.ok ? hopperRes.json() : [],
      completedRes?.ok ? completedRes.json() : [],
    ])

    // Build per-day block map
    const newDayBlocks: Record<string, LocalBlock[]> = {}
    dates.forEach(d => { newDayBlocks[d] = [] })

    const allBlocks: TimeBlock[] = Array.isArray(blocksData) ? blocksData : []
    allBlocks.forEach((b: TimeBlock) => {
      if (!newDayBlocks[b.block_date]) newDayBlocks[b.block_date] = []
      newDayBlocks[b.block_date].push({
        localId: b.id,
        dbId: b.id,
        label: b.label,
        start: b.start_time ? formatTime(b.start_time) : '?',
        end: b.end_time ? formatTime(b.end_time) : '?',
        rawStartTime: b.start_time ?? null,
        rawEndTime: b.end_time ?? null,
        energyLevel: b.time_type,
        isHardBlock: b.is_hard,
        items: [],
      })
    })

    // Place committed action items into blocks or committed section
    const schedItems: ActionItem[] = Array.isArray(schedData) ? schedData : []
    const newCommittedItems: Record<string, LocalItem[]> = {}
    dates.forEach(d => { newCommittedItems[d] = [] })

    schedItems.forEach((s: ActionItem) => {
      if (!s.committed_date) return
      // Skip non-active statuses
      if (s.status === 'rescheduled' || s.status === 'dismissed' || s.status === 'archived') return

      const localItem: LocalItem = {
        localId: s.id,
        actionItemId: s.id,
        activityId: s.activity_id ?? undefined,
        name: s.name,
        source: s.source ?? 'template_proposal',
        energyLevel: s.time_type as 'A' | 'B' | 'C' | 'D' | '0',
        emotionalWeight: s.emotional_weight as 'light' | 'normal' | 'heavy',
        durationMin: 15,
        durationMax: 30,
        flexibility: s.flexibility,
        values: [],
        isHard: s.flexibility === 'hard_scheduled',
        scheduledTime: s.scheduled_time ? formatTime(s.scheduled_time) : undefined,
        endTime: s.scheduled_end_time ? formatTime(s.scheduled_end_time) : undefined,
      }
      const tbId = s.time_block_id
      const dayBlocksForDate = newDayBlocks[s.committed_date] ?? []
      const matchBlock = tbId ? dayBlocksForDate.find(b => b.dbId === tbId) : null
      if (matchBlock) {
        matchBlock.items.push(localItem)
      } else if (!s.scheduled_time && newCommittedItems[s.committed_date]) {
        // Committed but unscheduled — show in committed section
        newCommittedItems[s.committed_date].push(localItem)
      }
    })

    // Build hopper — all candidate items (week view shows them all)
    const hopperItems: LocalItem[] = (Array.isArray(hopperData) ? hopperData : [])
      .map((h: ActionItem & { activity?: Partial<Activity> }) => {
        const act = h.activity ?? activities.find(a => a.id === h.activity_id)
        const meta = h.metadata as { requestedBy?: string; note?: string } | null
        return {
          localId: h.id,
          actionItemId: h.id,
          activityId: h.activity_id ?? undefined,
          name: h.name,
          source: h.source,
          energyLevel: (act?.time_type ?? h.time_type ?? 'B') as 'A' | 'B' | 'C' | 'D' | '0',
          emotionalWeight: (act?.emotional_weight ?? h.emotional_weight ?? 'normal') as 'light' | 'normal' | 'heavy',
          durationMin: act?.duration_range_min ?? 15,
          durationMax: act?.duration_range_max ?? 30,
          flexibility: act?.flexibility ?? h.flexibility ?? 'anytime_this_week',
          values: [],
          meta: meta ? { requestedBy: meta.requestedBy, note: meta.note } : undefined,
        }
      })

    // Build completed items
    const completedItems: CompletedItem[] = []
    if (Array.isArray(completedData)) {
      completedData.forEach((log: { id: string; event_date: string; metadata?: { name?: string; time_type?: string } }) => {
        const d = new Date(log.event_date + 'T12:00:00')
        const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1
        completedItems.push({
          id: log.id,
          name: log.metadata?.name ?? 'Item',
          dateStr: log.event_date,
          dayLabel: DAY_LABELS[dayIdx],
          energyLevel: log.metadata?.time_type ?? 'B',
          values: [],
        })
      })
    }

    setDayBlocks(newDayBlocks)
    setCommittedItems(newCommittedItems)
    setHopper(hopperItems)
    setCompleted(completedItems)
    setLoading(false)
  }, [weekStart, activities])

  useEffect(() => { loadData() }, [loadData])

  // ── Drag ─────────────────────────────────────────────────────────────────
  const handleDragStart = (item: LocalItem, from: string) => setDragItem({ ...item, fromSection: from })
  const handleDragEnd = () => { setDragItem(null); setDragOver(null) }

  const removeFromSource = (item: LocalItem & { fromSection: string }) => {
    if (item.fromSection === 'hopper') {
      setHopper(h => h.filter(i => i.localId !== item.localId))
    } else if (item.fromSection?.startsWith('block-')) {
      // block-DATESTR-BLOCKID
      const parts = item.fromSection.split('-')
      const dateKey = parts[1]
      const blockId = parts.slice(2).join('-')
      setDayBlocks(db => ({
        ...db,
        [dateKey]: (db[dateKey] ?? []).map(b =>
          b.localId === blockId ? { ...b, items: b.items.filter(i => i.localId !== item.localId) } : b
        ),
      }))
    } else if (item.fromSection?.startsWith('committed-')) {
      const dateKey = item.fromSection.replace('committed-', '')
      setCommittedItems(ci => ({ ...ci, [dateKey]: (ci[dateKey] ?? []).filter(i => i.localId !== item.localId) }))
    }
  }

  const dropOnBlock = async (dateKey: string, blockId: string) => {
    if (!dragItem || dragItem.isHard) return
    const targetBlock = (dayBlocks[dateKey] ?? []).find(b => b.localId === blockId)
    if (!targetBlock?.dbId) return

    // Remove from source
    removeFromSource(dragItem)

    // Add to target
    setDayBlocks(db => ({
      ...db,
      [dateKey]: (db[dateKey] ?? []).map(b =>
        b.localId === blockId ? { ...b, items: [...b.items, dragItem] } : b
      ),
    }))
    setDragOver(null)
    setDragItem(null)

    // Persist
    if (dragItem.actionItemId) {
      await fetch(`/api/action-items/${dragItem.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          committed_date: dateKey,
          time_block_id: targetBlock.dbId,
          scheduled_time: targetBlock.rawStartTime ?? null,
          scheduled_end_time: targetBlock.rawEndTime ?? null,
          status: 'committed',
        }),
      })
    }
  }

  const dropOnHopper = async () => {
    if (!dragItem || dragItem.isHard || dragItem.fromSection === 'hopper') return
    removeFromSource(dragItem)
    setHopper(h => [dragItem, ...h])
    setDragOver(null)
    setDragItem(null)

    if (dragItem.actionItemId) {
      await fetch(`/api/action-items/${dragItem.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
      })
    }
  }

  const returnToHopper = async (item: LocalItem, dateKey: string, blockId: string) => {
    if (item.isHard) return
    setDayBlocks(db => ({
      ...db,
      [dateKey]: (db[dateKey] ?? []).map(b =>
        b.localId === blockId ? { ...b, items: b.items.filter(i => i.localId !== item.localId) } : b
      ),
    }))
    setHopper(h => [item, ...h])

    if (item.actionItemId) {
      await fetch(`/api/action-items/${item.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
      })
    }
  }

  const dropOnCommitted = async (dateKey: string) => {
    if (!dragItem || dragItem.isHard) return
    removeFromSource(dragItem)
    setCommittedItems(ci => ({ ...ci, [dateKey]: [...(ci[dateKey] ?? []), dragItem] }))
    setDragOver(null)
    setDragItem(null)

    if (dragItem.actionItemId) {
      await fetch(`/api/action-items/${dragItem.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committed_date: dateKey, scheduled_time: null, scheduled_end_time: null, time_block_id: null, status: 'committed' }),
      })
    }
  }

  const returnCommittedToHopper = async (item: LocalItem, dateKey: string) => {
    setCommittedItems(ci => ({ ...ci, [dateKey]: (ci[dateKey] ?? []).filter(i => i.localId !== item.localId) }))
    setHopper(h => [item, ...h])

    if (item.actionItemId) {
      await fetch(`/api/action-items/${item.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'candidate', committed_date: null, scheduled_time: null, time_block_id: null }),
      })
    }
  }

  const commitFromHopper = async (item: LocalItem, dateKey: string) => {
    setHopper(h => h.filter(i => i.localId !== item.localId))
    setCommittedItems(ci => ({ ...ci, [dateKey]: [...(ci[dateKey] ?? []), item] }))

    if (item.actionItemId) {
      await fetch(`/api/action-items/${item.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committed_date: dateKey, status: 'committed' }),
      })
    }
  }

  const dismissHopper = (localId: string) => {
    const item = hopper.find(h => h.localId === localId)
    setHopper(h => h.filter(i => i.localId !== localId))
    if (item?.actionItemId) {
      fetch(`/api/action-items/${item.actionItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
    }
  }

  const captureItem = async () => {
    if (!captureInput.trim() || savingCapture) return
    setSavingCapture(true)
    const res = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: captureInput.trim(), source: 'quick_capture', status: 'candidate' }),
    })
    if (res.ok) {
      const newItem = await res.json()
      const localItem: LocalItem = {
        localId: newItem.id, actionItemId: newItem.id, name: newItem.name,
        source: 'quick_capture', energyLevel: 'B', emotionalWeight: 'normal',
        durationMin: 15, durationMax: 30, flexibility: 'anytime_this_week', values: [],
      }
      setHopper(h => [localItem, ...h])
    }
    setCaptureInput('')
    setSavingCapture(false)
  }

  // ── Week stats ────────────────────────────────────────────────────────────
  const allScheduled = Object.values(dayBlocks).flatMap(blocks => blocks.flatMap(b => b.items))
  const weekEnergyCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, '0': 0 }
  allScheduled.forEach(i => { weekEnergyCounts[i.energyLevel] = (weekEnergyCounts[i.energyLevel] ?? 0) + 1 })
  const weekValueCounts: Record<string, number> = {}
  ;[...allScheduled, ...completed].forEach(i => i.values?.forEach(v => { weekValueCounts[v] = (weekValueCounts[v] || 0) + 1 }))
  const dayItemCounts: Record<string, number> = {}
  weekDates.forEach(d => {
    const ds = dateStr(d)
    dayItemCounts[ds] = (dayBlocks[ds] ?? []).reduce((s, b) => s + b.items.length, 0) + (committedItems[ds] ?? []).length
  })
  const maxDayCount = Math.max(...Object.values(dayItemCounts), 1)

  const fh = hopperFilter === 'all' ? hopper : hopper.filter(h => h.energyLevel === hopperFilter)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <div style={{
        width: '97vw', height: '95vh', maxWidth: 1600, background: '#FAFAF7',
        borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid #E8E4DC', background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', letterSpacing: -0.3 }}>Organize</span>
            {/* Day | Week toggle */}
            <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid #E8E4DC', overflow: 'hidden' }}>
              <button onClick={onSwitchToDay} style={{ padding: '5px 14px', border: 'none', background: 'transparent', color: '#8A857D', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Day</button>
              <button style={{ padding: '5px 14px', border: 'none', background: '#2D2A26', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Week</button>
            </div>
            <span style={{ fontSize: 14, color: '#8A857D' }}>{weekLabel}</span>
            <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>← Prev</button>
            <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Next →</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onEditTemplate} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Edit Template</button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: Hopper */}
          <div
            onDragOver={e => { e.preventDefault(); if (dragItem && dragItem.fromSection !== 'hopper') setDragOver('hopper') }}
            onDragLeave={() => { if (dragOver === 'hopper') setDragOver(null) }}
            onDrop={dropOnHopper}
            style={{
              width: 280, borderRight: '1px solid #E8E4DC', display: 'flex', flexDirection: 'column',
              background: dragOver === 'hopper' ? '#F0EDE8' : 'white', transition: 'background 0.15s',
            }}
          >
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #E8E4DC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2D2A26' }}>This Week</span>
                <span style={{ fontSize: 11, color: '#8A857D' }}>{hopper.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {['all', 'A', 'B', 'C', 'D', '0'].map(f => (
                  <button key={f} onClick={() => setHopperFilter(f)} style={{
                    padding: '2px 8px', borderRadius: 5, border: '1px solid',
                    borderColor: hopperFilter === f ? (f === 'all' ? '#2D2A26' : EC[f]) : '#E8E4DC',
                    background: hopperFilter === f ? (f === 'all' ? '#2D2A2608' : EC[f] + '10') : 'transparent',
                    color: hopperFilter === f ? (f === 'all' ? '#2D2A26' : EC[f]) : '#8A857D',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif",
                  }}>{f === 'all' ? 'All' : EL[f]}</button>
                ))}
              </div>
              {dragItem && dragItem.fromSection !== 'hopper' && (
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 5, background: '#4B82AF10', border: '1.5px dashed #4B82AF', fontSize: 11, color: '#4B82AF', textAlign: 'center', fontWeight: 600 }}>← Drop to unschedule</div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
              {loading && <div style={{ padding: 20, textAlign: 'center', color: '#B5B0A8', fontSize: 12 }}>Loading...</div>}
              {!loading && fh.map(item => (
                <div key={item.localId} draggable
                  onDragStart={() => handleDragStart(item, 'hopper')}
                  onDragEnd={handleDragEnd}
                  style={{ padding: '8px 10px', marginBottom: 5, background: 'white', borderRadius: 8, border: '1.5px solid #E8E4DC', cursor: 'grab', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = EC[item.energyLevel]}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#E8E4DC'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: EC[item.energyLevel], flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', lineHeight: 1.2 }}>
                          {item.name}
                          {WI[item.emotionalWeight] && <span style={{ color: COLORS.primary, marginLeft: 3, fontSize: 9 }}>{WI[item.emotionalWeight]}</span>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 9, color: '#8A857D', background: '#F5F3EF', padding: '0 5px', borderRadius: 3 }}>{SI[item.source] ?? '●'} {SL[item.source] ?? item.source}</span>
                        <span style={{ fontSize: 9, color: '#8A857D' }}>{item.durationMin}–{item.durationMax}m</span>
                      </div>
                      {item.meta?.requestedBy && <div style={{ fontSize: 10, color: COLORS.primary, marginTop: 2, fontStyle: 'italic' }}>↗ {item.meta.requestedBy}</div>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); dismissHopper(item.localId) }}
                      style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 10, color: '#B5B0A8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                  </div>
                </div>
              ))}
              {!loading && fh.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#B5B0A8', fontSize: 12 }}>All set for the week</div>}
            </div>

            <div style={{ padding: '10px 12px', borderTop: '1px solid #E8E4DC' }}>
              <input
                type="text"
                placeholder="Capture something..."
                value={captureInput}
                onChange={e => setCaptureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') captureItem() }}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", background: '#FAFAF7', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* CENTER: 7-column calendar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E8E4DC', background: 'white', flexShrink: 0 }}>
              {weekDates.map((d, i) => {
                const ds = dateStr(d)
                const isToday = ds === today
                const count = dayItemCounts[ds] ?? 0
                return (
                  <div key={ds} style={{
                    flex: 1, padding: '8px 4px', textAlign: 'center',
                    borderRight: i < 6 ? '1px solid #F0EDE8' : 'none',
                    background: isToday ? COLORS.primary + '06' : 'transparent',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? COLORS.primary : '#2D2A26' }}>{DAY_LABELS[i]}</div>
                    <div style={{ fontSize: 10, color: isToday ? COLORS.primary : '#8A857D' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div style={{ fontSize: 9, color: '#B5B0A8', marginTop: 2 }}>{count} item{count !== 1 ? 's' : ''}</div>
                  </div>
                )
              })}
            </div>

            {/* Day columns */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {weekDates.map((d, i) => {
                const ds = dateStr(d)
                const isToday = ds === today
                const blocks = dayBlocks[ds] ?? []
                return (
                  <div key={ds} style={{
                    flex: 1, overflowY: 'auto', padding: '6px 4px',
                    borderRight: i < 6 ? '1px solid #F0EDE8' : 'none',
                    background: isToday ? COLORS.primary + '03' : 'transparent',
                  }}>
                    {loading && i === 0 && <div style={{ padding: 8, color: '#B5B0A8', fontSize: 10, textAlign: 'center' }}>Loading...</div>}
                    {blocks.map(block => (
                      <div key={block.localId}
                        onDragOver={e => { e.preventDefault(); setDragOver(`${ds}-${block.localId}`) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => dropOnBlock(ds, block.localId)}
                        style={{
                          marginBottom: 6, borderRadius: 8, overflow: 'hidden',
                          border: '1px solid',
                          borderColor: dragOver === `${ds}-${block.localId}` ? EC[block.energyLevel] : '#E8E4DC',
                          background: dragOver === `${ds}-${block.localId}` ? EC[block.energyLevel] + '08' : 'white',
                          transition: 'all 0.12s',
                        }}
                      >
                        {/* Block header */}
                        <div style={{
                          padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
                          borderBottom: block.items.length > 0 ? '1px solid #F0EDE8' : 'none',
                        }}>
                          <div style={{ width: 3, height: 16, borderRadius: 1, background: block.isHardBlock ? '#9E6A46' : EC[block.energyLevel], flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#2D2A26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.label}</div>
                            <div style={{ fontSize: 9, color: '#8A857D' }}>{block.start}–{block.end}</div>
                          </div>
                        </div>

                        {/* Items */}
                        {block.items.map(item => (
                          <div key={item.localId}
                            draggable={!item.isHard}
                            onDragStart={e => { if (item.isHard) return; e.stopPropagation(); handleDragStart(item, `block-${ds}-${block.localId}`) }}
                            onDragEnd={handleDragEnd}
                            style={{
                              padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
                              background: item.isHard ? '#9E6A4606' : '#FAFAF7',
                              cursor: item.isHard ? 'default' : 'grab',
                              borderBottom: '1px solid #F5F3EF',
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.isHard ? '#9E6A46' : EC[item.energyLevel], flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#2D2A26', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.name}
                              {WI[item.emotionalWeight] && <span style={{ color: COLORS.primary, fontSize: 8, marginLeft: 2 }}>{WI[item.emotionalWeight]}</span>}
                            </span>
                            {!item.isHard && (
                              <button onClick={e => { e.stopPropagation(); returnToHopper(item, ds, block.localId) }}
                                style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 8, color: '#C4BFB4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
                            )}
                          </div>
                        ))}

                        {block.items.length === 0 && !block.isHardBlock && (
                          <div style={{ padding: '6px 8px', textAlign: 'center', color: '#D0CBC3', fontSize: 9, fontStyle: 'italic' }}>Drop here</div>
                        )}
                      </div>
                    ))}

                    {/* Committed (unscheduled) section */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(`committed-${ds}`) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => dropOnCommitted(ds)}
                      style={{
                        marginTop: 4, borderRadius: 6, minHeight: 28,
                        border: '1px dashed',
                        borderColor: dragOver === `committed-${ds}` ? '#4B82AF' : (committedItems[ds] ?? []).length > 0 ? '#E8E4DC' : '#F0EDE8',
                        background: dragOver === `committed-${ds}` ? '#4B82AF08' : 'transparent',
                        transition: 'all 0.12s',
                      }}
                    >
                      {(committedItems[ds] ?? []).length > 0 && (
                        <div style={{ padding: '3px 8px', fontSize: 9, color: '#8A857D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          Committed
                        </div>
                      )}
                      {(committedItems[ds] ?? []).map(item => (
                        <div key={item.localId}
                          draggable
                          onDragStart={e => { e.stopPropagation(); handleDragStart(item, `committed-${ds}`) }}
                          onDragEnd={handleDragEnd}
                          style={{
                            padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
                            cursor: 'grab', borderBottom: '1px solid #F5F3EF',
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: EC[item.energyLevel], flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#2D2A26', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          <button onClick={e => { e.stopPropagation(); returnCommittedToHopper(item, ds) }}
                            style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 8, color: '#C4BFB4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
                        </div>
                      ))}
                      {(committedItems[ds] ?? []).length === 0 && (
                        <div style={{ padding: '6px 8px', textAlign: 'center', color: '#D0CBC3', fontSize: 9, fontStyle: 'italic' }}>
                          {dragItem ? 'Commit here' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Summary panel */}
          <div style={{ width: 240, borderLeft: '1px solid #E8E4DC', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tab toggle */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E8E4DC', flexShrink: 0 }}>
              {([{ key: 'summary', label: 'Week View' }, { key: 'completed', label: 'Done ✓' }] as const).map(t => (
                <button key={t.key} onClick={() => setRightPanel(t.key)} style={{
                  flex: 1, padding: '10px 0', border: 'none', borderBottom: '2px solid',
                  borderBottomColor: rightPanel === t.key ? COLORS.primary : 'transparent',
                  background: 'transparent', color: rightPanel === t.key ? COLORS.primary : '#8A857D',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif",
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {rightPanel === 'summary' ? (
                <>
                  {/* Energy */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time Balance</div>
                    {['A', 'B', 'C', 'D', '0'].map(level => (
                      <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: EC[level], width: 44 }}>{EL[level]}</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F5F3EF' }}>
                          <div style={{ width: `${Math.min(weekEnergyCounts[level] * 8, 100)}%`, height: '100%', borderRadius: 3, background: EC[level], transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#8A857D', width: 14, textAlign: 'right' }}>{weekEnergyCounts[level]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Values */}
                  {Object.keys(weekValueCounts).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Values This Week</div>
                      {Object.entries(weekValueCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#2D2A26', marginBottom: 3 }}>
                          <span>{name}</span>
                          <span style={{ background: '#9E6A4612', color: '#9E6A46', padding: '0 5px', borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Items per day bar chart */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Items Per Day</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                      {weekDates.map((d, i) => {
                        const ds = dateStr(d)
                        const count = dayItemCounts[ds] ?? 0
                        const isToday = ds === today
                        return (
                          <div key={ds} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{
                              width: '100%', borderRadius: 3,
                              height: Math.max(4, (count / maxDayCount) * 48),
                              background: isToday ? COLORS.primary : '#4B82AF40',
                              transition: 'height 0.3s',
                            }} />
                            <span style={{ fontSize: 8, color: isToday ? COLORS.primary : '#8A857D', fontWeight: 600 }}>{DAY_LABELS[i]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Unscheduled */}
                  <div style={{ padding: 10, borderRadius: 8, background: '#F5F3EF', border: '1px solid #E8E4DC' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', marginBottom: 3 }}>Unscheduled</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: hopper.length > 0 ? COLORS.primary : '#5A9E6F' }}>{hopper.length}</div>
                    <div style={{ fontSize: 10, color: '#B5B0A8' }}>{hopper.length > 0 ? 'items still in hopper' : 'everything placed'}</div>
                  </div>
                </>
              ) : (
                <>
                  {/* Completed */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#5A9E6F', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Completed This Week</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#5A9E6F', marginBottom: 2 }}>{completed.length}</div>
                    <div style={{ fontSize: 11, color: '#8A857D', marginBottom: 12 }}>things done</div>
                  </div>

                  {weekDates.map((d, i) => {
                    const dayCompleted = completed.filter(c => c.dateStr === dateStr(d))
                    if (dayCompleted.length === 0) return null
                    return (
                      <div key={dateStr(d)} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#8A857D', marginBottom: 4 }}>
                          {DAY_LABELS[i]} {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        {dayCompleted.map(item => (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                            background: '#5A9E6F08', borderRadius: 6, marginBottom: 3,
                            border: '1px solid #5A9E6F15',
                          }}>
                            <span style={{ color: '#5A9E6F', fontSize: 12, flexShrink: 0 }}>✓</span>
                            <span style={{ fontSize: 11, color: '#2D2A26', flex: 1 }}>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}

                  {/* Values expressed */}
                  {completed.length > 0 && (
                    <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#5A9E6F08', border: '1px solid #5A9E6F15' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#5A9E6F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Values Expressed</div>
                      {(() => {
                        const vc: Record<string, number> = {}
                        completed.forEach(i => i.values?.forEach(v => { vc[v] = (vc[v] || 0) + 1 }))
                        if (Object.keys(vc).length === 0) return <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>No value links yet</div>
                        return Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#2D2A26', marginBottom: 2 }}>
                            <span>{name}</span>
                            <span style={{ background: '#5A9E6F18', color: '#5A9E6F', padding: '0 5px', borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{count}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  )}

                  {/* Integrity stub */}
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#F5F3EF', border: '1px solid #E8E4DC' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', marginBottom: 3 }}>Integrity Score</div>
                    <div style={{ fontSize: 10, color: '#B5B0A8', fontStyle: 'italic' }}>Coming soon — committed vs. completed</div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
