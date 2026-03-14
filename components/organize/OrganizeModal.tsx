'use client'
import { useState, useEffect, useCallback } from 'react'
import { HopperItem, ScheduleItem, TimeBlock, UserValue, LifeDomain, Activity } from '@/lib/types'
import OrganizeWeekView from './OrganizeWeekView'
import TimeTemplateEditor from './TimeTemplateEditor'

// ── Constants ─────────────────────────────────────────────────────────────────
const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#7A9E82' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Easy' }
const SL: Record<string, string> = { template_proposal: 'Suggested', outside_request: 'Request', quick_capture: 'Captured', planning_function: 'From Plan' }
const SI: Record<string, string> = { template_proposal: '◈', outside_request: '↗', quick_capture: '✎', planning_function: '◎' }
const WI: Record<string, string> = { light: '', normal: '', heavy: '◆' }

const DEFAULT_TEMPLATE = [
  { label: 'Morning Focus', start: '8:00', end: '10:00', energyLevel: 'A' as const },
  { label: 'Comms & Calls', start: '10:00', end: '11:00', energyLevel: 'B' as const },
  { label: 'Deep Work', start: '11:00', end: '12:30', energyLevel: 'A' as const },
  { label: 'Lunch & Errands', start: '12:30', end: '2:00', energyLevel: 'C' as const },
  { label: 'Computer Time', start: '2:00', end: '4:00', energyLevel: 'B' as const },
  { label: 'Open / Buffer', start: '4:00', end: '5:00', energyLevel: 'C' as const },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Local types ───────────────────────────────────────────────────────────────
interface LocalItem {
  localId: string
  scheduleItemId?: string
  hopperItemId?: string
  activityId?: string
  name: string
  source: string
  energyLevel: 'A' | 'B' | 'C'
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
  energyLevel: 'A' | 'B' | 'C'
  isHardBlock?: boolean
  items: LocalItem[]
}

interface HopperEditState {
  localId: string
  hopperItemId?: string
  mode: 'menu' | 'ask-later' | 'schedule'
  name: string
  askLaterDate: string
  schedDate: string
  schedTime: string
  schedDuration: number
  schedBlockId: string
}

interface SchedEditState {
  localId: string
  scheduleItemId?: string
  hopperItemId?: string
  name: string
  schedTime: string
  blockId: string
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void
  values: UserValue[]
  domains: LifeDomain[]
  activities: Activity[]
}

// ── Helper utilities ──────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0] }

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function todayDayAbbr() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '?'
  const parts = t.split(':')
  const h = parseInt(parts[0])
  const m = parts[1] ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`
}

// Parses capture text for date, time, and duration hints
function parseScheduleInfo(text: string): { date: string; time: string; durationMin: number } {
  const result = { date: todayStr(), time: '', durationMin: 60 }

  // Time: "3pm", "at 3:30pm", "10am", "2:30 PM"
  const timeMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (timeMatch) {
    let h = parseInt(timeMatch[1])
    const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const ap = timeMatch[3].toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    result.time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // Duration: "30 min", "1 hour", "2 hours", "45 minutes"
  const durMatch = text.match(/\b(\d+)\s*(min(?:utes?)?|h(?:ou)?rs?)\b/i)
  if (durMatch) {
    const val = parseInt(durMatch[1])
    result.durationMin = /^h/i.test(durMatch[2]) ? val * 60 : val
  }

  // Relative dates
  const lc = text.toLowerCase()
  if (lc.includes('tomorrow')) {
    const d = new Date(); d.setDate(d.getDate() + 1)
    result.date = d.toISOString().split('T')[0]
  } else if (!lc.includes('today')) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    for (let i = 0; i < dayNames.length; i++) {
      if (lc.includes(dayNames[i])) {
        const d = new Date()
        let diff = i - d.getDay()
        if (diff <= 0) diff += 7
        d.setDate(d.getDate() + diff)
        result.date = d.toISOString().split('T')[0]
        break
      }
    }
  }

  return result
}

// ── InlineAdd ─────────────────────────────────────────────────────────────────
function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ padding: '4px 10px 6px', display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: '#C4BFB4', fontSize: 14 }}>+</span>
      <input
        type="text" value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal('') } }}
        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: '#2D2A26', fontFamily: "'Source Sans 3', sans-serif", padding: '3px 0' }}
      />
    </div>
  )
}

// ── Small shared styles ────────────────────────────────────────────────────────
const btnSm = (active?: boolean, color?: string): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 6, border: '1px solid',
  borderColor: active ? (color ?? '#C4725A') : '#E8E4DC',
  background: active ? (color ?? '#C4725A') + '14' : 'transparent',
  color: active ? (color ?? '#C4725A') : '#8A857D',
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif",
})

// ── Main component ────────────────────────────────────────────────────────────
export default function OrganizeModal({ onClose, values, domains, activities }: Props) {
  const [mode, setMode] = useState<'setup' | 'reorg' | 'capture'>('setup')
  const [selectedDay, setSelectedDay] = useState(todayDayAbbr())
  const [hopper, setHopper] = useState<LocalItem[]>([])
  const [timeBlocks, setTimeBlocks] = useState<LocalBlock[]>([])
  const [unscheduledTasks, setUnscheduledTasks] = useState<LocalItem[]>([])
  const [loading, setLoading] = useState(true)

  // Drag state
  const [dragItem, setDragItem] = useState<LocalItem & { fromSection: string } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragBlock, setDragBlock] = useState<string | null>(null)
  const [dragBlockOver, setDragBlockOver] = useState<string | null>(null)
  const [hopperDrag, setHopperDrag] = useState<string | null>(null)
  const [hopperDragOver, setHopperDragOver] = useState<string | null>(null)

  // UI state
  const [completions, setCompletions] = useState<Record<string, 'done' | 'skipped'>>({})
  const [committed, setCommitted] = useState(false)
  const [reflection, setReflection] = useState('')
  const [moodEnergy, setMoodEnergy] = useState(3)
  const [hopperFilter, setHopperFilter] = useState('all')
  const [showTemplate, setShowTemplate] = useState(true)
  const [addingBlock, setAddingBlock] = useState(false)
  const [newBlock, setNewBlock] = useState({ label: '', start: '', end: '', energyLevel: 'B' as 'A' | 'B' | 'C' })
  const [saving, setSaving] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)

  // Edit state
  const [hopperEdit, setHopperEdit] = useState<HopperEditState | null>(null)
  const [schedEdit, setSchedEdit] = useState<SchedEditState | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const today = todayStr()
    // Propose due activities into hopper before loading (fire-and-forget is fine,
    // but we await so new proposals appear immediately in the hopper fetch below)
    await fetch('/api/hopper/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_date: today }),
    }).catch(() => {}) // non-fatal if it fails

    const [hopperRes, schedRes, blocksRes] = await Promise.all([
      fetch('/api/hopper?status=pending'),
      fetch(`/api/schedule?date=${today}`),
      fetch(`/api/time-blocks?date=${today}`).catch(() => ({ ok: false, json: async () => [] })),
    ])
    const [hopperData, schedData, blocksData] = await Promise.all([
      hopperRes.ok ? hopperRes.json() : [],
      schedRes.ok ? schedRes.json() : [],
      (blocksRes as Response).ok ? (blocksRes as Response).json() : [],
    ])

    const hopperItems: LocalItem[] = (Array.isArray(hopperData) ? hopperData : []).map((h: HopperItem) => {
      const act = h.activity as Activity | undefined
      const meta = h.metadata as { requestedBy?: string; note?: string } | null
      return {
        localId: h.id,
        hopperItemId: h.id,
        activityId: h.activity_id ?? undefined,
        name: h.raw_input,
        source: h.source,
        energyLevel: (act?.energy_level ?? 'B') as 'A' | 'B' | 'C',
        emotionalWeight: (act?.emotional_weight ?? 'normal') as 'light' | 'normal' | 'heavy',
        durationMin: act?.duration_range_min ?? 15,
        durationMax: act?.duration_range_max ?? 30,
        flexibility: act?.flexibility ?? 'anytime_today',
        values: [],
        meta: meta ? { requestedBy: meta.requestedBy, note: meta.note } : undefined,
      }
    })

    const dbBlocks: TimeBlock[] = Array.isArray(blocksData) ? blocksData : []
    const schedItems: ScheduleItem[] = Array.isArray(schedData) ? schedData : []

    let localBlocks: LocalBlock[]
    if (dbBlocks.length > 0) {
      localBlocks = dbBlocks.map((b: TimeBlock) => ({
        localId: b.id, dbId: b.id, label: b.label,
        start: b.start_time ? formatTime(b.start_time) : '?',
        end: b.end_time ? formatTime(b.end_time) : '?',
        energyLevel: b.energy_level as 'A' | 'B' | 'C',
        isHardBlock: b.is_hard, items: [],
      }))
    } else {
      localBlocks = DEFAULT_TEMPLATE.map((t, i) => ({
        localId: `default-${i}`, label: t.label, start: t.start, end: t.end, energyLevel: t.energyLevel, items: [],
      }))
    }

    const unscheduled: LocalItem[] = []
    schedItems.forEach((s: ScheduleItem) => {
      const localItem: LocalItem = {
        localId: s.id, scheduleItemId: s.id,
        hopperItemId: s.hopper_item_id ?? undefined,
        activityId: s.activity_id ?? undefined,
        name: s.name, source: 'template_proposal',
        energyLevel: s.energy_level as 'A' | 'B' | 'C',
        emotionalWeight: s.emotional_weight as 'light' | 'normal' | 'heavy',
        durationMin: 15, durationMax: 30, flexibility: s.flexibility, values: [],
        isHard: s.flexibility === 'hard_scheduled',
        scheduledTime: s.scheduled_time ? formatTime(s.scheduled_time) : undefined,
        endTime: s.scheduled_end_time ? formatTime(s.scheduled_end_time) : undefined,
      }
      const tbId = (s as ScheduleItem & { time_block_id?: string }).time_block_id
      const matchBlock = tbId ? localBlocks.find(b => b.dbId === tbId) : null
      if (matchBlock) matchBlock.items.push(localItem)
      else unscheduled.push(localItem)
    })

    setHopper(hopperItems)
    setTimeBlocks(localBlocks)
    setUnscheduledTasks(unscheduled)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Check calendar connection status
  useEffect(() => {
    fetch('/api/calendar/settings')
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setCalendarConnected(d.connected ?? false))
      .catch(() => {})
  }, [])

  // ── Cross-panel drag ──────────────────────────────────────────────────────
  const handleDragStart = (item: LocalItem, from: string) => setDragItem({ ...item, fromSection: from })
  const handleDragEnd = () => { setDragItem(null); setDragOver(null) }

  const removeFromSource = (item: LocalItem & { fromSection: string }) => {
    if (item.fromSection === 'hopper') setHopper(h => h.filter(i => i.localId !== item.localId))
    else if (item.fromSection === 'unscheduled') setUnscheduledTasks(t => t.filter(i => i.localId !== item.localId))
    else if (item.fromSection?.startsWith('block-')) {
      const bid = item.fromSection.replace('block-', '')
      setTimeBlocks(bs => bs.map(b => b.localId === bid ? { ...b, items: b.items.filter(i => i.localId !== item.localId) } : b))
    }
  }

  const dropOnBlock = async (bid: string) => {
    if (!dragItem || dragItem.isHard) return
    const block = timeBlocks.find(b => b.localId === bid)
    removeFromSource(dragItem)
    setTimeBlocks(bs => bs.map(b => b.localId === bid ? { ...b, items: [...b.items, dragItem!] } : b))
    setDragOver(null); setDragItem(null)
    if (dragItem.fromSection === 'hopper' && dragItem.hopperItemId) {
      await fetch('/api/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dragItem.name, hopper_item_id: dragItem.hopperItemId, activity_id: dragItem.activityId ?? null, scheduled_date: todayStr(), flexibility: dragItem.flexibility, energy_level: dragItem.energyLevel, emotional_weight: dragItem.emotionalWeight, time_block_id: block?.dbId ?? null }),
      })
    }
  }

  const dropOnUnsched = async () => {
    if (!dragItem || dragItem.isHard) return
    removeFromSource(dragItem)
    setUnscheduledTasks(t => [...t, dragItem!])
    setDragOver(null); setDragItem(null)
    if (dragItem.fromSection === 'hopper' && dragItem.hopperItemId) {
      await fetch('/api/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dragItem.name, hopper_item_id: dragItem.hopperItemId, activity_id: dragItem.activityId ?? null, scheduled_date: todayStr(), flexibility: 'anytime_today', energy_level: dragItem.energyLevel, emotional_weight: dragItem.emotionalWeight }),
      })
    }
  }

  const dropOnHopper = async () => {
    if (!dragItem || dragItem.isHard || dragItem.fromSection === 'hopper') return
    removeFromSource(dragItem)
    setHopper(h => [dragItem!, ...h])
    setDragOver(null); setDragItem(null)
    if (dragItem.scheduleItemId) await fetch(`/api/schedule/${dragItem.scheduleItemId}`, { method: 'DELETE' })
    if (dragItem.hopperItemId) await fetch(`/api/hopper/${dragItem.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending', resolved_at: null }) })
  }

  const returnToHopper = async (item: LocalItem, from: string) => {
    if (item.isHard) return
    if (from === 'unscheduled') setUnscheduledTasks(t => t.filter(i => i.localId !== item.localId))
    else if (from?.startsWith('block-')) {
      const bid = from.replace('block-', '')
      setTimeBlocks(bs => bs.map(b => b.localId === bid ? { ...b, items: b.items.filter(i => i.localId !== item.localId) } : b))
    }
    setHopper(h => [item, ...h])
    if (item.scheduleItemId) await fetch(`/api/schedule/${item.scheduleItemId}`, { method: 'DELETE' })
    if (item.hopperItemId) await fetch(`/api/hopper/${item.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending', resolved_at: null }) })
  }

  const dismissHopper = async (id: string) => {
    setHopper(h => h.filter(i => i.localId !== id))
    await fetch(`/api/hopper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'dismissed', resolved_at: new Date().toISOString() }) })
  }

  // ── Hopper editing ────────────────────────────────────────────────────────
  const openHopperEdit = (item: LocalItem) => {
    const parsed = parseScheduleInfo(item.name)
    setSchedEdit(null)
    setHopperEdit({
      localId: item.localId,
      hopperItemId: item.hopperItemId,
      mode: 'menu',
      name: item.name,
      askLaterDate: '',
      schedDate: parsed.date,
      schedTime: parsed.time,
      schedDuration: parsed.durationMin,
      schedBlockId: 'unscheduled',
    })
  }

  const saveHopperName = async () => {
    if (!hopperEdit) return
    const trimmed = hopperEdit.name.trim()
    if (!trimmed) return
    setHopper(h => h.map(i => i.localId === hopperEdit.localId ? { ...i, name: trimmed } : i))
    if (hopperEdit.hopperItemId) {
      await fetch(`/api/hopper/${hopperEdit.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_input: trimmed }) })
    }
  }

  const snoozeHopper = async () => {
    if (!hopperEdit || !hopperEdit.askLaterDate) return
    setHopper(h => h.filter(i => i.localId !== hopperEdit.localId))
    if (hopperEdit.hopperItemId) {
      await fetch(`/api/hopper/${hopperEdit.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposed_date: hopperEdit.askLaterDate }) })
    }
    setHopperEdit(null)
  }

  const scheduleFromHopper = async () => {
    if (!hopperEdit) return
    const item = hopper.find(i => i.localId === hopperEdit.localId)
    if (!item) return

    const block = hopperEdit.schedBlockId !== 'unscheduled' ? timeBlocks.find(b => b.localId === hopperEdit.schedBlockId) : null

    // Remove from hopper
    setHopper(h => h.filter(i => i.localId !== hopperEdit.localId))

    // Add to block/unscheduled
    const newItem: LocalItem = { ...item, name: hopperEdit.name.trim() || item.name, scheduledTime: hopperEdit.schedTime ? formatTime(hopperEdit.schedTime) : undefined }
    if (block) {
      setTimeBlocks(bs => bs.map(b => b.localId === block.localId ? { ...b, items: [...b.items, newItem] } : b))
    } else {
      setUnscheduledTasks(t => [...t, newItem])
    }

    // Persist
    if (hopperEdit.hopperItemId) {
      if (hopperEdit.name.trim() && hopperEdit.name.trim() !== item.name) {
        await fetch(`/api/hopper/${hopperEdit.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_input: hopperEdit.name.trim() }) })
      }
      const res = await fetch('/api/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hopperEdit.name.trim() || item.name,
          hopper_item_id: hopperEdit.hopperItemId,
          activity_id: item.activityId ?? null,
          scheduled_date: hopperEdit.schedDate,
          scheduled_time: hopperEdit.schedTime || null,
          scheduled_end_time: hopperEdit.schedTime ? computeEndTime(hopperEdit.schedTime, hopperEdit.schedDuration) : null,
          flexibility: hopperEdit.schedTime ? 'soft_scheduled' : 'anytime_today',
          energy_level: item.energyLevel,
          emotional_weight: item.emotionalWeight,
          time_block_id: block?.dbId ?? null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Update the local item with real schedule ID
        const updateItem = (items: LocalItem[]) => items.map(i => i.localId === item.localId ? { ...i, scheduleItemId: data.id } : i)
        if (block) setTimeBlocks(bs => bs.map(b => b.localId === block.localId ? { ...b, items: updateItem(b.items) } : b))
        else setUnscheduledTasks(updateItem)
      }
    }
    setHopperEdit(null)
  }

  // ── Scheduled item editing ────────────────────────────────────────────────
  const openSchedEdit = (item: LocalItem, currentBlockId: string) => {
    if (item.isHard) return
    setHopperEdit(null)
    setSchedEdit({
      localId: item.localId,
      scheduleItemId: item.scheduleItemId,
      hopperItemId: item.hopperItemId,
      name: item.name,
      schedTime: item.scheduledTime ? toInputTime(item.scheduledTime) : '',
      blockId: currentBlockId,
    })
  }

  const saveSchedEdit = async () => {
    if (!schedEdit) return
    const trimmed = schedEdit.name.trim()
    if (!trimmed) return

    const newBlockId = schedEdit.blockId
    const origBlockId = findItemBlock(schedEdit.localId)

    // Update name + time locally
    const updateFn = (items: LocalItem[]) => items.map(i => i.localId === schedEdit.localId
      ? { ...i, name: trimmed, scheduledTime: schedEdit.schedTime ? formatTime(schedEdit.schedTime) : undefined }
      : i
    )

    if (origBlockId === newBlockId) {
      // Same block, just update in place
      if (newBlockId === 'unscheduled') setUnscheduledTasks(updateFn)
      else setTimeBlocks(bs => bs.map(b => b.localId === newBlockId ? { ...b, items: updateFn(b.items) } : b))
    } else {
      // Move to different block
      const item = findItem(schedEdit.localId)
      if (item) {
        const updated = { ...item, name: trimmed, scheduledTime: schedEdit.schedTime ? formatTime(schedEdit.schedTime) : undefined }
        // Remove from original
        if (origBlockId === 'unscheduled') setUnscheduledTasks(t => t.filter(i => i.localId !== schedEdit.localId))
        else setTimeBlocks(bs => bs.map(b => b.localId === origBlockId ? { ...b, items: b.items.filter(i => i.localId !== schedEdit.localId) } : b))
        // Add to new
        if (newBlockId === 'unscheduled') setUnscheduledTasks(t => [...t, updated])
        else setTimeBlocks(bs => bs.map(b => b.localId === newBlockId ? { ...b, items: [...b.items, updated] } : b))
      }
    }

    // Persist
    if (schedEdit.scheduleItemId) {
      const block = newBlockId !== 'unscheduled' ? timeBlocks.find(b => b.localId === newBlockId) : null
      await fetch(`/api/schedule/${schedEdit.scheduleItemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          scheduled_time: schedEdit.schedTime || null,
          time_block_id: block?.dbId ?? null,
        }),
      })
    }
    setSchedEdit(null)
  }

  const deleteSchedItem = async (item: LocalItem, from: string) => {
    if (from === 'unscheduled') setUnscheduledTasks(t => t.filter(i => i.localId !== item.localId))
    else {
      const bid = from.startsWith('block-') ? from.replace('block-', '') : from
      setTimeBlocks(bs => bs.map(b => b.localId === bid ? { ...b, items: b.items.filter(i => i.localId !== item.localId) } : b))
    }
    if (item.scheduleItemId) await fetch(`/api/schedule/${item.scheduleItemId}`, { method: 'DELETE' })
    if (item.hopperItemId) await fetch(`/api/hopper/${item.hopperItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending', resolved_at: null }) })
    setSchedEdit(null)
  }

  // ── Block reorder ─────────────────────────────────────────────────────────
  const blockDragStart = (bid: string) => { if (timeBlocks.find(b => b.localId === bid)?.isHardBlock) return; setDragBlock(bid) }
  const blockDrop = (tid: string) => {
    if (!dragBlock || dragBlock === tid) { setDragBlock(null); setDragBlockOver(null); return }
    setTimeBlocks(bs => { const n = [...bs]; const fi = n.findIndex(b => b.localId === dragBlock); const ti = n.findIndex(b => b.localId === tid); const [m] = n.splice(fi, 1); n.splice(ti, 0, m); return n })
    setDragBlock(null); setDragBlockOver(null)
  }

  // ── Hopper reorder ────────────────────────────────────────────────────────
  const hopperReorderOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (hopperDrag && hopperDrag !== id) setHopperDragOver(id) }
  const hopperReorderDrop = (tid: string) => {
    if (!hopperDrag || hopperDrag === tid) { setHopperDrag(null); setHopperDragOver(null); return }
    setHopper(h => { const n = [...h]; const fi = n.findIndex(i => i.localId === hopperDrag); const ti = n.findIndex(i => i.localId === tid); const [m] = n.splice(fi, 1); n.splice(ti, 0, m); return n })
    setHopperDrag(null); setHopperDragOver(null)
  }

  // ── Inline creation ───────────────────────────────────────────────────────
  const addItemToBlock = async (blockId: string, name: string) => {
    const block = timeBlocks.find(b => b.localId === blockId)
    const today = todayStr()
    const item: LocalItem = { localId: 'new-' + Date.now(), name, source: 'quick_capture', energyLevel: block?.energyLevel ?? 'B', emotionalWeight: 'normal', durationMin: 15, durationMax: 30, flexibility: 'anytime_today', values: [] }
    setTimeBlocks(bs => bs.map(b => b.localId === blockId ? { ...b, items: [...b.items, item] } : b))
    const hr = await fetch('/api/hopper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_input: name, source: 'quick_capture', proposed_date: today }) })
    if (hr.ok) {
      const h = await hr.json()
      await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, hopper_item_id: h.id, scheduled_date: today, flexibility: 'anytime_today', energy_level: block?.energyLevel ?? 'B', emotional_weight: 'normal', time_block_id: block?.dbId ?? null }) })
    }
  }

  const addItemToUnsched = async (name: string) => {
    const today = todayStr()
    const item: LocalItem = { localId: 'new-' + Date.now(), name, source: 'quick_capture', energyLevel: 'B', emotionalWeight: 'normal', durationMin: 15, durationMax: 30, flexibility: 'anytime_today', values: [] }
    setUnscheduledTasks(t => [...t, item])
    const hr = await fetch('/api/hopper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_input: name, source: 'quick_capture', proposed_date: today }) })
    if (hr.ok) { const h = await hr.json(); await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, hopper_item_id: h.id, scheduled_date: today, flexibility: 'anytime_today', energy_level: 'B', emotional_weight: 'normal' }) }) }
  }

  const captureToHopper = async (name: string) => {
    const item: LocalItem = { localId: 'hc-' + Date.now(), name, source: 'quick_capture', energyLevel: 'B', emotionalWeight: 'normal', durationMin: 15, durationMax: 30, flexibility: 'anytime_today', values: [] }
    setHopper(h => [item, ...h])
    const res = await fetch('/api/hopper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_input: name, source: 'quick_capture' }) })
    if (res.ok) { const data = await res.json(); setHopper(h => h.map(i => i.localId === item.localId ? { ...i, localId: data.id, hopperItemId: data.id } : i)) }
  }

  // ── Add time block ────────────────────────────────────────────────────────
  const createBlock = async () => {
    if (!newBlock.label.trim()) return
    const today = todayStr()
    const block: LocalBlock = { localId: 'tb-' + Date.now(), label: newBlock.label.trim(), start: newBlock.start || '?', end: newBlock.end || '?', energyLevel: newBlock.energyLevel, items: [] }
    setTimeBlocks(bs => [...bs.filter(b => !b.isHardBlock), block, ...bs.filter(b => b.isHardBlock)])
    setNewBlock({ label: '', start: '', end: '', energyLevel: 'B' })
    setAddingBlock(false)
    const res = await fetch('/api/time-blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block_date: today, label: block.label, start_time: newBlock.start || null, end_time: newBlock.end || null, energy_level: newBlock.energyLevel }) })
    if (res.ok) { const data = await res.json(); setTimeBlocks(bs => bs.map(b => b.localId === block.localId ? { ...b, dbId: data.id } : b)) }
  }

  // ── Commit / close day ────────────────────────────────────────────────────
  const commitPlan = async () => {
    setCommitted(true)
    await fetch('/api/day-reflection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reflection_date: todayStr(), plan_status: 'committed' }) })
  }

  const closeDay = async () => {
    setSaving(true)
    const today = todayStr()
    const allItems = allSched()
    await Promise.all(allItems.map(async item => {
      if (!item.scheduleItemId) return
      const status = completions[item.localId] === 'done' ? 'completed' : completions[item.localId] === 'skipped' ? 'skipped' : 'active'
      if (status !== 'active') await fetch(`/api/schedule/${item.scheduleItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    }))
    await fetch('/api/day-reflection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reflection_date: today, plan_status: 'closed', mood_energy: moodEnergy, journal_note: reflection || null }) })
    setSaving(false)
    onClose()
  }

  // ── Local helpers ─────────────────────────────────────────────────────────
  const findItem = (localId: string): LocalItem | undefined => {
    for (const b of timeBlocks) { const i = b.items.find(i => i.localId === localId); if (i) return i }
    return unscheduledTasks.find(i => i.localId === localId)
  }
  const findItemBlock = (localId: string): string => {
    for (const b of timeBlocks) { if (b.items.find(i => i.localId === localId)) return b.localId }
    return 'unscheduled'
  }

  const toggleDone = (id: string) => setCompletions(c => ({ ...c, [id]: c[id] === 'done' ? undefined as unknown as 'done' : 'done' }))
  const toggleSkip = (id: string) => setCompletions(c => ({ ...c, [id]: c[id] === 'skipped' ? undefined as unknown as 'skipped' : 'skipped' }))

  const allSched = () => [
    ...timeBlocks.flatMap(b => b.items.map(i => ({ ...i, block: b.label, blockTime: b.start }))),
    ...unscheduledTasks.map(i => ({ ...i, block: 'Anytime today', blockTime: null as string | null })),
  ]

  const fh = hopperFilter === 'all' ? hopper : hopper.filter(h => h.energyLevel === hopperFilter)
  const totalSched = timeBlocks.reduce((s, b) => s + b.items.length, 0) + unscheduledTasks.length

  // ── Render hopper item (with expand/edit) ─────────────────────────────────
  const renderHopperItem = (item: LocalItem) => {
    const isEditing = hopperEdit?.localId === item.localId
    return (
      <div key={item.localId} draggable={!isEditing}
        onDragStart={() => { if (isEditing) return; handleDragStart(item, 'hopper'); setHopperDrag(item.localId) }}
        onDragEnd={() => { handleDragEnd(); setHopperDrag(null); setHopperDragOver(null) }}
        onDragOver={e => hopperReorderOver(e, item.localId)}
        onDrop={e => { e.stopPropagation(); hopperReorderDrop(item.localId) }}
        style={{
          marginBottom: 6, background: 'white', borderRadius: 10,
          border: '1.5px solid', borderColor: isEditing ? '#C4725A' : hopperDragOver === item.localId ? '#C4725A' : '#E8E4DC',
          transition: 'all 0.15s', opacity: hopperDrag === item.localId ? 0.4 : 1,
          cursor: isEditing ? 'default' : 'grab',
        }}
      >
        {/* Item header */}
        <div
          onClick={() => isEditing ? setHopperEdit(null) : openHopperEdit(item)}
          style={{ padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
        >
          {!isEditing && (
            <div draggable onDragStart={e => { e.stopPropagation(); setHopperDrag(item.localId) }} onDragEnd={() => { setHopperDrag(null); setHopperDragOver(null) }}
              style={{ cursor: 'grab', color: '#D0CBC3', fontSize: 14, lineHeight: 1, userSelect: 'none', flexShrink: 0, paddingTop: 1 }}>⠿</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: EC[item.energyLevel] }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2D2A26', lineHeight: 1.2 }}>
                {item.name}
                {WI[item.emotionalWeight] && <span style={{ color: '#C4725A', marginLeft: 4, fontSize: 10 }}>{WI[item.emotionalWeight]}</span>}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#8A857D', background: '#F5F3EF', padding: '1px 6px', borderRadius: 4 }}>{SI[item.source] ?? '●'} {SL[item.source] ?? item.source}</span>
              <span style={{ fontSize: 10, color: '#8A857D' }}>{item.durationMin}–{item.durationMax}m</span>
            </div>
            {item.meta?.requestedBy && <div style={{ fontSize: 11, color: '#C4725A', marginTop: 4, fontStyle: 'italic' }}>↗ {item.meta.requestedBy}: {item.meta.note}</div>}
          </div>
          {!isEditing && (
            <button onClick={e => { e.stopPropagation(); dismissHopper(item.localId) }} title="Dismiss"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#B5B0A8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          )}
        </div>

        {/* Edit panel */}
        {isEditing && hopperEdit && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid #F0EDE6' }}>
            {/* Editable name */}
            <input
              value={hopperEdit.name}
              onChange={e => setHopperEdit(h => h ? { ...h, name: e.target.value } : h)}
              onBlur={saveHopperName}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', marginTop: 10, marginBottom: 10, boxSizing: 'border-box', background: '#FAFAF7' }}
            />

            {hopperEdit.mode === 'menu' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setHopperEdit(h => h ? { ...h, mode: 'schedule' } : h)} style={{ ...btnSm(false), background: '#C4725A', color: 'white', borderColor: '#C4725A' }}>Schedule it</button>
                <button onClick={() => setHopperEdit(h => h ? { ...h, mode: 'ask-later' } : h)} style={btnSm()}>Ask me later</button>
                <button onClick={() => dismissHopper(item.localId)} style={{ ...btnSm(), color: '#D4564E', borderColor: '#D4564E30' }}>Dismiss</button>
              </div>
            )}

            {hopperEdit.mode === 'ask-later' && (
              <div>
                <div style={{ fontSize: 11, color: '#8A857D', marginBottom: 6 }}>Remind me on:</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={hopperEdit.askLaterDate} min={todayStr()}
                    onChange={e => setHopperEdit(h => h ? { ...h, askLaterDate: e.target.value } : h)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                  <button onClick={snoozeHopper} disabled={!hopperEdit.askLaterDate}
                    style={{ ...btnSm(!!hopperEdit.askLaterDate), background: hopperEdit.askLaterDate ? '#C4725A' : 'transparent', color: hopperEdit.askLaterDate ? 'white' : '#B5B0A8', borderColor: hopperEdit.askLaterDate ? '#C4725A' : '#E8E4DC' }}>OK</button>
                  <button onClick={() => setHopperEdit(h => h ? { ...h, mode: 'menu' } : h)} style={btnSm()}>Back</button>
                </div>
              </div>
            )}

            {hopperEdit.mode === 'schedule' && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 3 }}>Date</div>
                    <input type="date" value={hopperEdit.schedDate}
                      onChange={e => setHopperEdit(h => h ? { ...h, schedDate: e.target.value } : h)}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 3 }}>Time (opt.)</div>
                    <input type="time" value={hopperEdit.schedTime}
                      onChange={e => setHopperEdit(h => h ? { ...h, schedTime: e.target.value } : h)}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 3 }}>Duration</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min={5} max={480} step={5} value={hopperEdit.schedDuration}
                        onChange={e => setHopperEdit(h => h ? { ...h, schedDuration: parseInt(e.target.value) || 60 } : h)}
                        style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                      <span style={{ fontSize: 11, color: '#8A857D' }}>min</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 3 }}>Block</div>
                  <select value={hopperEdit.schedBlockId} onChange={e => setHopperEdit(h => h ? { ...h, schedBlockId: e.target.value } : h)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', background: 'white' }}>
                    <option value="unscheduled">To-dos (no specific time)</option>
                    {timeBlocks.filter(b => !b.isHardBlock).map(b => <option key={b.localId} value={b.localId}>{b.label} ({b.start}–{b.end})</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={scheduleFromHopper} style={{ ...btnSm(), background: '#C4725A', color: 'white', borderColor: '#C4725A' }}>Schedule</button>
                  <button onClick={() => setHopperEdit(h => h ? { ...h, mode: 'menu' } : h)} style={btnSm()}>Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render scheduled item (with inline edit) ───────────────────────────────
  const renderSchedItem = (item: LocalItem, from: string) => {
    const blockId = from.startsWith('block-') ? from.replace('block-', '') : 'unscheduled'
    const isEditing = schedEdit?.localId === item.localId
    return (
      <div key={item.localId}
        style={{ marginBottom: 3, borderRadius: 8, border: '1px solid', borderColor: isEditing ? '#C4725A' : 'transparent', background: item.isHard ? '#9E6A4608' : '#FAFAF7', overflow: 'hidden' }}
      >
        {/* Item row */}
        <div
          draggable={!item.isHard && !isEditing}
          onDragStart={e => { if (item.isHard || isEditing) return; e.stopPropagation(); handleDragStart(item, from) }}
          onDragEnd={handleDragEnd}
          onClick={() => !item.isHard && (isEditing ? setSchedEdit(null) : openSchedEdit(item, blockId))}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            cursor: item.isHard ? 'default' : 'pointer', fontSize: 13, color: '#2D2A26',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.isHard ? '#9E6A46' : EC[item.energyLevel], flexShrink: 0 }} />
          <span style={{ flex: 1, fontWeight: 500 }}>
            {item.name}
            {item.isHard && item.scheduledTime && <span style={{ fontSize: 10, color: '#9E6A46', marginLeft: 6 }}>{item.scheduledTime}{item.endTime ? ` – ${item.endTime}` : ''}</span>}
            {WI[item.emotionalWeight] && <span style={{ color: '#C4725A', marginLeft: 4, fontSize: 10 }}>{WI[item.emotionalWeight]}</span>}
          </span>
          {!item.isHard && !isEditing && <>
            <span style={{ fontSize: 11, color: '#B5B0A8' }}>{item.durationMin}–{item.durationMax}m</span>
            <button onClick={e => { e.stopPropagation(); returnToHopper(item, from) }} title="Return to hopper"
              style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#B5B0A8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
          </>}
        </div>

        {/* Inline edit form */}
        {isEditing && schedEdit && (
          <div style={{ padding: '0 10px 10px', borderTop: '1px solid #F0EDE6' }}>
            <input value={schedEdit.name} onChange={e => setSchedEdit(s => s ? { ...s, name: e.target.value } : s)}
              style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', marginTop: 8, marginBottom: 8, boxSizing: 'border-box', background: '#FAFAF7' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 2 }}>Time (opt.)</div>
                <input type="time" value={schedEdit.schedTime} onChange={e => setSchedEdit(s => s ? { ...s, schedTime: e.target.value } : s)}
                  style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 10, color: '#8A857D', marginBottom: 2 }}>Move to block</div>
                <select value={schedEdit.blockId} onChange={e => setSchedEdit(s => s ? { ...s, blockId: e.target.value } : s)}
                  style={{ width: '100%', padding: '4px 7px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif", outline: 'none', background: 'white' }}>
                  <option value="unscheduled">To-dos</option>
                  {timeBlocks.filter(b => !b.isHardBlock).map(b => <option key={b.localId} value={b.localId}>{b.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveSchedEdit} style={{ ...btnSm(), background: '#C4725A', color: 'white', borderColor: '#C4725A' }}>Save</button>
              <button onClick={() => deleteSchedItem(item, from)} style={{ ...btnSm(), color: '#D4564E', borderColor: '#D4564E30' }}>Delete</button>
              <button onClick={() => setSchedEdit(null)} style={btnSm()}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Week view — full replacement
  if (viewMode === 'week') {
    return (
      <>
        <OrganizeWeekView
          onClose={onClose}
          onSwitchToDay={() => setViewMode('day')}
          onEditTemplate={() => setShowTemplateEditor(true)}
          values={values}
          domains={domains}
          activities={activities}
        />
        {showTemplateEditor && <TimeTemplateEditor onClose={() => setShowTemplateEditor(false)} />}
      </>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Sans 3', sans-serif" }}>
      <div style={{ width: '96vw', height: '93vh', maxWidth: 1500, background: '#FAFAF7', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #E8E4DC', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', letterSpacing: -0.3 }}>Organize</span>
            {/* Day | Week toggle */}
            <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid #E8E4DC', overflow: 'hidden' }}>
              <button style={{ padding: '5px 14px', border: 'none', background: '#2D2A26', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Day</button>
              <button onClick={() => setViewMode('week')} style={{ padding: '5px 14px', border: 'none', background: 'transparent', color: '#8A857D', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Week</button>
            </div>
            <span style={{ fontSize: 14, color: '#8A857D' }}>{todayLabel()}</span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
              {([{ key: 'setup', label: 'Setup' }, { key: 'reorg', label: 'Reorg' }, { key: 'capture', label: 'Capture' }] as const).map(m => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{ padding: '6px 16px', borderRadius: 8, border: '1.5px solid', borderColor: mode === m.key ? '#C4725A' : '#E8E4DC', background: mode === m.key ? '#C4725A10' : 'transparent', color: mode === m.key ? '#C4725A' : '#8A857D', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setShowTemplateEditor(true)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Edit Template</button>
            {!calendarConnected ? (
              <button onClick={async () => {
                const res = await fetch('/api/calendar/connect', { method: 'POST' })
                if (res.ok) {
                  const { url } = await res.json()
                  if (url) window.location.href = url
                }
              }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>
                Connect Calendar
              </button>
            ) : (
              <span style={{ fontSize: 11, color: '#5A9E6F' }}>📅 Calendar connected</span>
            )}
            {mode !== 'capture' && !committed && totalSched > 0 && (
              <button onClick={commitPlan} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#C4725A', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Commit Plan ({totalSched} items)</button>
            )}
            {committed && mode !== 'capture' && <span style={{ fontSize: 13, color: '#5A9E6F', fontWeight: 600 }}>✓ Plan committed</span>}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E8E4DC', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        {showTemplateEditor && <TimeTemplateEditor onClose={() => setShowTemplateEditor(false)} />}

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: Hopper */}
          {mode !== 'capture' && (
            <div onDragOver={e => { e.preventDefault(); if (dragItem && dragItem.fromSection !== 'hopper') setDragOver('hopper') }} onDragLeave={() => { if (dragOver === 'hopper') setDragOver(null) }} onDrop={dropOnHopper}
              style={{ width: 340, borderRight: '1px solid #E8E4DC', display: 'flex', flexDirection: 'column', background: dragOver === 'hopper' ? '#F0EDE8' : 'white', transition: 'background 0.15s' }}>
              <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid #E8E4DC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#2D2A26' }}>Hopper</span>
                  <span style={{ fontSize: 12, color: '#8A857D' }}>{hopper.length} items</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['all', 'A', 'B', 'C'].map(f => (
                    <button key={f} onClick={() => setHopperFilter(f)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid', borderColor: hopperFilter === f ? (f === 'all' ? '#2D2A26' : EC[f]) : '#E8E4DC', background: hopperFilter === f ? (f === 'all' ? '#2D2A2608' : EC[f] + '10') : 'transparent', color: hopperFilter === f ? (f === 'all' ? '#2D2A26' : EC[f]) : '#8A857D', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{f === 'all' ? 'All' : EL[f]}</button>
                  ))}
                </div>
                {dragItem && dragItem.fromSection !== 'hopper' && (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#4B82AF10', border: '1.5px dashed #4B82AF', fontSize: 12, color: '#4B82AF', textAlign: 'center', fontWeight: 600 }}>← Drop here to unschedule</div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {loading && <div style={{ padding: 20, textAlign: 'center', color: '#B5B0A8', fontSize: 13 }}>Loading...</div>}
                {!loading && fh.map(item => renderHopperItem(item))}
                {!loading && fh.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#B5B0A8', fontSize: 13 }}>{hopperFilter === 'all' ? 'Hopper is clear' : `No ${EL[hopperFilter]?.toLowerCase()} items`}</div>}
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E4DC' }}>
                <input type="text" placeholder="Capture something..."
                  onKeyDown={e => { const t = e.target as HTMLInputElement; if (e.key === 'Enter' && t.value.trim()) { captureToHopper(t.value.trim()); t.value = '' } }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E8E4DC', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", background: '#FAFAF7', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          {/* CENTER: Day Plan */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 24px', borderBottom: '1px solid #E8E4DC', display: 'flex', alignItems: 'center', gap: 4, background: '#FAFAF7' }}>
              {DAYS.map(d => (
                <button key={d} onClick={() => setSelectedDay(d)} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid', borderColor: selectedDay === d ? '#2D2A26' : 'transparent', background: selectedDay === d ? 'white' : 'transparent', color: selectedDay === d ? '#2D2A26' : '#8A857D', fontSize: 13, fontWeight: selectedDay === d ? 700 : 400, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{d}</button>
              ))}
              <div style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showTemplate} onChange={e => setShowTemplate(e.target.checked)} style={{ accentColor: '#C4BFB4' }} />
                <span style={{ fontSize: 11, color: '#B5B0A8' }}>Show time template</span>
              </label>
            </div>

            {mode === 'capture' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                <div style={{ maxWidth: 640, margin: '0 auto' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 4 }}>Close out the day</h3>
                  <p style={{ fontSize: 13, color: '#8A857D', marginBottom: 20 }}>Check off what got done. This is your integrity data.</p>
                  {allSched().length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#B5B0A8', fontSize: 14 }}>No items scheduled today.</div>
                  ) : (<>
                    {allSched().map(item => (
                      <div key={item.localId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 6, background: 'white', borderRadius: 10, border: '1.5px solid', borderColor: completions[item.localId] === 'done' ? '#5A9E6F' : completions[item.localId] === 'skipped' ? '#D4564E40' : '#E8E4DC' }}>
                        <button onClick={() => toggleDone(item.localId)} style={{ width: 24, height: 24, borderRadius: 7, border: '2px solid', borderColor: completions[item.localId] === 'done' ? '#5A9E6F' : '#D0CBC3', background: completions[item.localId] === 'done' ? '#5A9E6F' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, flexShrink: 0 }}>{completions[item.localId] === 'done' ? '✓' : ''}</button>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: '#2D2A26', textDecoration: completions[item.localId] === 'done' ? 'line-through' : 'none', opacity: completions[item.localId] === 'skipped' ? 0.4 : 1 }}>{item.name}</span>
                          <span style={{ fontSize: 11, color: '#B5B0A8', marginLeft: 8 }}>{item.blockTime ? `${item.blockTime} · ${item.block}` : item.block}</span>
                        </div>
                        <button onClick={() => toggleSkip(item.localId)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid', borderColor: completions[item.localId] === 'skipped' ? '#D4564E' : '#E8E4DC', background: completions[item.localId] === 'skipped' ? '#D4564E10' : 'transparent', color: completions[item.localId] === 'skipped' ? '#D4564E' : '#B5B0A8', fontSize: 11, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Didn&apos;t do</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '1.5px solid #E8E4DC' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2A26', marginBottom: 12 }}>Reflection</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: '#8A857D', width: 80 }}>Energy / Mood</span>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setMoodEnergy(n)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid', borderColor: moodEnergy === n ? '#C4725A' : '#E8E4DC', background: moodEnergy === n ? '#C4725A10' : 'transparent', color: moodEnergy === n ? '#C4725A' : '#8A857D', fontSize: 14, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{n}</button>
                        ))}
                      </div>
                      <textarea placeholder="How was today? (optional)" value={reflection} onChange={e => setReflection(e.target.value)}
                        style={{ width: '100%', minHeight: 60, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E4DC', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", resize: 'vertical', outline: 'none', background: '#FAFAF7', boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={closeDay} disabled={saving} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#B5B0A8' : '#5A9E6F', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{saving ? 'Saving...' : 'Close Day'}</button>
                  </>)}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {timeBlocks.map(block => {
                  const tmpl = showTemplate ? DEFAULT_TEMPLATE.find(t => t.label === block.label) : null
                  return (
                    <div key={block.localId} style={{ position: 'relative', marginBottom: 12 }}>
                      {tmpl && <div style={{ position: 'absolute', inset: -2, borderRadius: 14, border: '1.5px dashed ' + EC[tmpl.energyLevel] + '35', background: EC[tmpl.energyLevel] + '05', pointerEvents: 'none', zIndex: 0 }}><div style={{ position: 'absolute', top: 5, right: 10, fontSize: 9, color: EC[tmpl.energyLevel] + '70', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>template</div></div>}
                      <div draggable={!block.isHardBlock && !dragItem}
                        onDragStart={e => { if (dragItem) return; e.dataTransfer.effectAllowed = 'move'; blockDragStart(block.localId) }}
                        onDragOver={e => { e.preventDefault(); if (dragItem) setDragOver(block.localId); else if (dragBlock && dragBlock !== block.localId) setDragBlockOver(block.localId) }}
                        onDragLeave={() => { setDragOver(null); setDragBlockOver(null) }}
                        onDrop={() => { if (dragItem) dropOnBlock(block.localId); else if (dragBlock) blockDrop(block.localId) }}
                        onDragEnd={() => { setDragBlock(null); setDragBlockOver(null) }}
                        style={{ position: 'relative', zIndex: 1, borderRadius: 12, border: '1.5px solid', borderColor: dragBlockOver === block.localId ? '#C4725A' : dragOver === block.localId ? EC[block.energyLevel] : '#E8E4DC', background: dragBlockOver === block.localId ? '#C4725A08' : dragOver === block.localId ? EC[block.energyLevel] + '08' : 'white', transition: 'all 0.15s', overflow: 'hidden', opacity: dragBlock === block.localId ? 0.4 : 1, cursor: block.isHardBlock ? 'default' : (dragItem ? 'default' : 'grab') }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: (block.items.length > 0 || !block.isHardBlock) ? '1px solid #E8E4DC' : 'none' }}>
                          {!block.isHardBlock && <div title="Drag to reorder block" style={{ cursor: 'grab', color: '#C4BFB4', fontSize: 16, userSelect: 'none', lineHeight: 1 }}>⠿</div>}
                          <div style={{ width: 4, height: 28, borderRadius: 2, background: block.isHardBlock ? '#9E6A46' : EC[block.energyLevel] }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#2D2A26' }}>{block.label}</span>
                            <span style={{ fontSize: 12, color: '#8A857D', marginLeft: 8 }}>{block.start} – {block.end}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: block.isHardBlock ? '#9E6A46' : EC[block.energyLevel], background: (block.isHardBlock ? '#9E6A46' : EC[block.energyLevel]) + '12', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{block.isHardBlock ? 'committed' : EL[block.energyLevel] + ' time'}</span>
                        </div>
                        {block.items.length > 0 && <div style={{ padding: '6px 12px 2px' }}>{block.items.map(item => renderSchedItem(item, `block-${block.localId}`))}</div>}
                        {!block.isHardBlock && <InlineAdd placeholder="Add task..." onAdd={name => addItemToBlock(block.localId, name)} />}
                        {block.items.length === 0 && !block.isHardBlock && <div style={{ padding: '4px 16px 10px', textAlign: 'center', color: '#C4BFB4', fontSize: 12, fontStyle: 'italic' }}>Drop {EL[block.energyLevel]?.toLowerCase()} tasks here</div>}
                      </div>
                    </div>
                  )
                })}

                {!addingBlock ? (
                  <button onClick={() => setAddingBlock(true)} style={{ width: '100%', padding: '10px', marginBottom: 12, borderRadius: 12, border: '1.5px dashed #D0CBC3', background: 'transparent', color: '#8A857D', fontSize: 13, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C4725A'; (e.currentTarget as HTMLElement).style.color = '#C4725A' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D0CBC3'; (e.currentTarget as HTMLElement).style.color = '#8A857D' }}
                  >+ Add time block</button>
                ) : (
                  <div style={{ padding: '14px 16px', marginBottom: 12, borderRadius: 12, border: '1.5px solid #C4725A', background: 'white' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input type="text" placeholder="Block name" value={newBlock.label} onChange={e => setNewBlock(b => ({ ...b, label: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') createBlock(); if (e.key === 'Escape') setAddingBlock(false) }} autoFocus
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <input type="text" placeholder="Start" value={newBlock.start} onChange={e => setNewBlock(b => ({ ...b, start: e.target.value }))} style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                      <span style={{ color: '#B5B0A8', fontSize: 12 }}>–</span>
                      <input type="text" placeholder="End" value={newBlock.end} onChange={e => setNewBlock(b => ({ ...b, end: e.target.value }))} style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif", outline: 'none' }} />
                      <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
                        {(['A', 'B', 'C'] as const).map(level => (
                          <button key={level} onClick={() => setNewBlock(b => ({ ...b, energyLevel: level }))} style={{ padding: '3px 8px', borderRadius: 5, border: '1.5px solid', borderColor: newBlock.energyLevel === level ? EC[level] : '#E8E4DC', background: newBlock.energyLevel === level ? EC[level] + '10' : 'transparent', color: newBlock.energyLevel === level ? EC[level] : '#8A857D', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>{EL[level]}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={createBlock} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#C4725A', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Add Block</button>
                      <button onClick={() => { setAddingBlock(false); setNewBlock({ label: '', start: '', end: '', energyLevel: 'B' }) }} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E8E4DC', background: 'transparent', color: '#8A857D', fontSize: 12, cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif" }}>Cancel</button>
                    </div>
                  </div>
                )}

                <div onDragOver={e => { e.preventDefault(); setDragOver('unscheduled') }} onDragLeave={() => setDragOver(null)} onDrop={dropOnUnsched}
                  style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px dashed', borderColor: dragOver === 'unscheduled' ? '#4B82AF' : '#D0CBC3', background: dragOver === 'unscheduled' ? '#4B82AF08' : '#FAFAF7', minHeight: 48, transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8A857D', marginBottom: 6 }}>To-dos (no specific time)</div>
                  {unscheduledTasks.map(item => renderSchedItem(item, 'unscheduled'))}
                  <InlineAdd placeholder="Add to-do..." onAdd={addItemToUnsched} />
                  {unscheduledTasks.length === 0 && <div style={{ textAlign: 'center', color: '#C4BFB4', fontSize: 12, fontStyle: 'italic', padding: 4 }}>Drop tasks here or type above</div>}
                </div>

                <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, border: '1.5px dashed #D0CBC3', background: '#F5F3EF', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: '#B5B0A8' }}>Google Calendar integration: coming soon</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Context */}
          <div style={{ width: 240, borderLeft: '1px solid #E8E4DC', background: 'white', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Day at a Glance</div>
              {timeBlocks.map(b => (
                <div key={b.localId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 1, background: b.isHardBlock ? '#9E6A46' : EC[b.energyLevel] }} />
                  <span style={{ fontSize: 11, color: '#8A857D', flex: 1 }}>{b.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: b.items.length > 0 ? '#2D2A26' : '#C4BFB4' }}>{b.items.length}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ width: 3, height: 14, borderRadius: 1, background: '#B5B0A8' }} />
                <span style={{ fontSize: 11, color: '#8A857D', flex: 1 }}>Anytime today</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: unscheduledTasks.length > 0 ? '#2D2A26' : '#C4BFB4' }}>{unscheduledTasks.length}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Energy Balance</div>
              {(['A', 'B', 'C'] as const).map(level => {
                const c = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks].filter(i => i.energyLevel === level).length
                return (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: EC[level], width: 50 }}>{EL[level]}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F5F3EF' }}><div style={{ width: `${Math.min(c * 20, 100)}%`, height: '100%', borderRadius: 3, background: EC[level], transition: 'width 0.3s' }} /></div>
                    <span style={{ fontSize: 11, color: '#8A857D', width: 16, textAlign: 'right' }}>{c}</span>
                  </div>
                )
              })}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2A26', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Values Served Today</div>
              {(() => {
                const ai = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks]
                const vc: Record<string, number> = {}
                ai.forEach(i => i.values?.forEach((v: string) => { vc[v] = (vc[v] || 0) + 1 }))
                const e = Object.entries(vc).sort((a, b) => b[1] - a[1])
                if (!e.length) return <span style={{ fontSize: 11, color: '#C4BFB4', fontStyle: 'italic' }}>Schedule items to see values coverage</span>
                return e.map(([n, count]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#2D2A26', marginBottom: 3 }}>
                    <span>{n}</span><span style={{ background: '#9E6A4612', color: '#9E6A46', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{count}</span>
                  </div>
                ))
              })()}
            </div>

            {(() => {
              const hv = [...timeBlocks.flatMap(b => b.items), ...unscheduledTasks].filter(i => i.emotionalWeight === 'heavy')
              if (!hv.length) return null
              return (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#C4725A08', border: '1px solid #C4725A20' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#C4725A', marginBottom: 4 }}>◆ Heavy items today</div>
                  {hv.map(i => <div key={i.localId} style={{ fontSize: 11, color: '#8A857D', marginBottom: 2 }}>{i.name}</div>)}
                  <div style={{ fontSize: 10, color: '#B5B0A8', marginTop: 4, fontStyle: 'italic' }}>Consider scheduling these during your best energy</div>
                </div>
              )
            })()}

            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F5F3EF', border: '1px solid #E8E4DC' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', marginBottom: 4 }}>Integrity Score</div>
              <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>Coming soon — committed vs. completed over time</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Utility: compute end time string from start + duration ─────────────────
function computeEndTime(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMins = h * 60 + m + durationMin
  return `${Math.floor(totalMins / 60).toString().padStart(2, '0')}:${(totalMins % 60).toString().padStart(2, '0')}`
}

// ── Utility: convert display time back to HH:MM input format ──────────────
function toInputTime(display: string): string {
  // Already HH:MM format
  if (/^\d{2}:\d{2}$/.test(display)) return display
  // Convert "3 PM" or "3:30 PM" format
  const m = display.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!m) return ''
  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}
