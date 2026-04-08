'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ActionItemWithNotes, ItemNote } from '@/lib/types'
import CaptureInput from '@/components/capture/CaptureInput'

// ─── Hopper types & constants ────────────────────────────────────────────────

const CADENCE_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, annual: 365,
}

interface HopperItem {
  id: string
  name: string
  source: string
  time_type: string
  emotional_weight: string
  priority_tier: string
  priority_score: number
  activity_id?: string | null
  activity?: {
    time_type?: string
    emotional_weight?: string
    duration_range_min?: number | null
    duration_range_max?: number | null
    preferred_time?: string | null
    frequency?: string | null
  } | null
}

interface SuggestedItem {
  id: string // 'activity:${activityId}'
  name: string
  time_type: string
  emotional_weight: string
  activity_id: string
  preferred_time: string | null
  frequency: string | null
  duration_min: number
  duration_max: number
}

interface SuggestedData {
  activities: Array<{
    id: string; name: string; time_type: string; emotional_weight: string
    frequency: string | null; duration_range_min: number | null; duration_range_max: number | null
    preferred_time: string | null; is_active: boolean
  }>
  coverage: Array<{ activity_id: string; committed_date: string }>
  dismissedActivityIds: string[]
  weekStart: string
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

const SCHEDULE_TIME_OPTIONS = ['morning', 'afternoon', 'evening'] as const
const SCHEDULE_TIME_LABELS: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
const SCHEDULE_DUR_OPTIONS = [15, 30, 45, 60, 90]

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function fmtTime(t: string) {
  // t = "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'a' : 'p'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function fmtNoteTime(isoStr: string) {
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h < 12 ? 'a' : 'p'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function currentTimeStr() {
  const now = new Date()
  return now.toTimeString().slice(0, 5) // HH:MM
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  committed: 1,
  parked: 2,
  completed: 3,
  skipped: 4,
  rescheduled: 5,
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({ status, onClick }: { status: string; onClick?: () => void }) {
  const base: React.CSSProperties = {
    width: 14, height: 14,
    border: '1.5px solid',
    borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default', flexShrink: 0, position: 'relative', overflow: 'hidden',
  }

  if (status === 'committed') {
    return (
      <span style={{ ...base, borderColor: '#B5B0A8', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick?.() }} />
    )
  }
  if (status === 'in_progress') {
    return (
      <span style={{ ...base, borderColor: '#C4725A', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick?.() }}>
        <span style={{ width: 6, height: 6, background: '#C4725A', borderRadius: 1 }} />
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span style={{ ...base, borderColor: '#8A857D', background: '#8A857D', color: 'white', fontSize: 10 }}
        onClick={e => { e.stopPropagation(); onClick?.() }}>
        ✓
      </span>
    )
  }
  if (status === 'parked') {
    return (
      <span style={{ ...base, borderColor: '#B5B0A8', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick?.() }}>
        <span style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 7,
          background: '#B5B0A8',
        }} />
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span style={{ ...base, borderColor: '#B5B0A8', background: 'transparent', color: '#B5B0A8', fontSize: 10, fontWeight: 700 }}
        onClick={e => { e.stopPropagation(); onClick?.() }}>
        ✕
      </span>
    )
  }
  // fallback
  return (
    <span style={{ ...base, borderColor: '#B5B0A8' }}
      onClick={e => { e.stopPropagation(); onClick?.() }} />
  )
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

function parseQuickTime(input: string): string | null {
  if (!input.trim()) return null
  const s = input.trim().toLowerCase().replace(/\s+/g, '')
  // "230p" → "14:30", "9a" → "09:00", "12" → "12:00", "14:30" → "14:30", "2:30pm" → "14:30"
  const m = s.match(/^(\d{1,2}):?(\d{2})?\s*(a|am|p|pm)?$/)
  if (!m) return null
  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const ampm = m[3]
  if (ampm?.startsWith('p') && h < 12) h += 12
  if (ampm?.startsWith('a') && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function addMinutesHHMM(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function generateTimePills(isToday: boolean): { label: string; value: string }[] {
  const pills: { label: string; value: string }[] = []
  const now = new Date()
  let startHour: number

  if (isToday) {
    const mins = now.getMinutes()
    const roundedMin = Math.ceil(mins / 5) * 5
    const nowH = roundedMin >= 60 ? now.getHours() + 1 : now.getHours()
    const nowM = roundedMin >= 60 ? 0 : roundedMin
    pills.push({ label: 'Now', value: `${String(nowH).padStart(2, '0')}:${String(nowM).padStart(2, '0')}` })
    // Start hourly pills from the next full hour after "Now"
    startHour = nowH + 1
  } else {
    startHour = 8
  }

  for (let h = startHour; h < Math.min(startHour + 6, 22); h++) {
    if (h > 23) break
    const ampm = h < 12 ? 'a' : 'p'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    pills.push({ label: `${display}${ampm}`, value: `${String(h).padStart(2, '0')}:00` })
  }

  return pills
}

const DURATION_PILLS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
]

function InlineScheduler({ isToday, pickedTime, onPickTime, customTime, onCustomTimeChange, onConfirm, onCancel }: {
  isToday: boolean
  pickedTime: string | null
  onPickTime: (t: string) => void
  customTime: string
  onCustomTimeChange: (v: string) => void
  onConfirm: (duration: number | null) => void
  onCancel: () => void
}) {
  const [pickedDuration, setPickedDuration] = useState<number | null>(null)
  const timePills = generateTimePills(isToday)
  const resolvedTime = pickedTime || parseQuickTime(customTime)

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 4, border: '1px solid',
    borderColor: active ? '#4B82AF' : '#E8E4DC',
    background: active ? '#4B82AF' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#2D2A26',
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
  })

  // Summary of what will be scheduled
  const summary = resolvedTime
    ? `${fmtTime(resolvedTime)}${pickedDuration ? ` – ${fmtTime(addMinutesHHMM(resolvedTime, pickedDuration))} (${pickedDuration >= 60 ? `${pickedDuration / 60}h` : `${pickedDuration}m`})` : ''}`
    : null

  return (
    <div style={{ marginTop: 20, padding: '12px 0' }}>
      <div style={{ fontSize: 11, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Schedule
      </div>

      {/* Time pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {timePills.map(p => (
          <button key={p.value} onClick={() => { onPickTime(p.value); onCustomTimeChange('') }}
            style={pillStyle(pickedTime === p.value)}>
            {p.label}
          </button>
        ))}
        <input
          value={customTime}
          onChange={e => { onCustomTimeChange(e.target.value); onPickTime('') }}
          placeholder="or type 2:30p"
          style={{
            width: 80, padding: '6px 8px', borderRadius: 4,
            border: `1px solid ${customTime && parseQuickTime(customTime) ? '#4B82AF' : '#E8E4DC'}`,
            fontSize: 13, color: '#2D2A26', fontFamily: 'inherit',
            outline: 'none', background: '#FFFFFF',
          }}
          onKeyDown={e => { if (e.key === 'Enter' && resolvedTime) onConfirm(pickedDuration) }}
        />
      </div>

      {/* Duration pills — show after time is picked */}
      {resolvedTime && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {DURATION_PILLS.map(d => (
            <button key={d.value} onClick={() => setPickedDuration(pickedDuration === d.value ? null : d.value)}
              style={pillStyle(pickedDuration === d.value)}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Confirm / cancel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
        {resolvedTime && (
          <button onClick={() => onConfirm(pickedDuration)} style={{
            padding: '8px 20px', borderRadius: 4, border: 'none',
            background: '#4B82AF', color: '#FFFFFF',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Schedule{summary ? ` at ${summary}` : ''}
          </button>
        )}
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#B5B0A8', padding: 0, fontFamily: 'inherit' }}>
          cancel
        </button>
      </div>
    </div>
  )
}

// ─── FocusView ────────────────────────────────────────────────────────────────

interface FocusViewProps {
  item: ActionItemWithNotes
  onBack: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onTitleChange: (id: string, name: string) => Promise<{ oldTitleNote?: ItemNote }>
  onAddNote: (actionItemId: string, noteType: 'note' | 'step', content: string) => Promise<ItemNote>
  onCompleteStep: (noteId: string) => Promise<void>
  onAddFollowUp: (content: string, sourceId: string) => Promise<void>
  onMoveToTomorrow: (id: string) => Promise<void>
  onMarkDoneAndCapture: (id: string, followUpText: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSchedule: (id: string, time: string, endTime: string | null) => Promise<void>
  onUnschedule: (id: string) => Promise<void>
  nextUp: ActionItemWithNotes | null
  isToday: boolean
  isPast: boolean
  selectedDate: string
}

function FocusView({
  item, onBack, onStatusChange, onTitleChange, onAddNote, onCompleteStep, onAddFollowUp, onMoveToTomorrow, onMarkDoneAndCapture, onDelete, onSchedule, onUnschedule, nextUp, isToday, isPast, selectedDate,
}: FocusViewProps) {
  const [title, setTitle] = useState(item.name)
  const [editingTitle, setEditingTitle] = useState(false)
  const [wasTitle, setWasTitle] = useState<string | null>(null)
  const [notes, setNotes] = useState<ItemNote[]>(item.item_notes ?? [])
  const [noteInput, setNoteInput] = useState('')
  const [stepInput, setStepInput] = useState('')
  const [followUpInput, setFollowUpInput] = useState('')
  const [captureFollowUp, setCaptureFollowUp] = useState('')
  const [showCaptureFollowUp, setShowCaptureFollowUp] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [showSteps, setShowSteps] = useState(true)
  const [pickedTime, setPickedTime] = useState<string | null>(null)
  const [customTime, setCustomTime] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const steps = notes.filter(n => n.note_type === 'step').sort((a, b) => a.sort_order - b.sort_order)
  const notesList = notes.filter(n => n.note_type === 'note').sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const isTimeLocked = !!item.scheduled_time

  async function handleTitleBlur() {
    setEditingTitle(false)
    if (title === item.name) return
    setSaving(true)
    try {
      const result = await onTitleChange(item.id, title)
      if (result.oldTitleNote) {
        setNotes(prev => [result.oldTitleNote!, ...prev])
        setWasTitle(item.name)
        setTimeout(() => setWasTitle(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckStep(stepId: string) {
    await onCompleteStep(stepId)
    setNotes(prev => prev.map(n => n.id === stepId ? { ...n, is_completed: true } : n))
  }

  async function handleAddStep() {
    if (!stepInput.trim()) return
    try {
      const maxOrder = steps.reduce((max, s) => Math.max(max, s.sort_order), -1)
      const newStep = await onAddNote(item.id, 'step', stepInput.trim())
      newStep.sort_order = maxOrder + 1
      setNotes(prev => [...prev, newStep])
      setStepInput('')
    } catch (err) {
      console.error('Failed to save step:', err)
    }
  }

  async function handleAddNote(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !noteInput.trim()) return
    e.preventDefault()
    try {
      const n = await onAddNote(item.id, 'note', noteInput.trim())
      setNotes(prev => [n, ...prev])
      setNoteInput('')
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  async function handleAddFollowUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !followUpInput.trim()) return
    e.preventDefault()
    await onAddFollowUp(followUpInput.trim(), item.id)
    setFollowUpInput('')
  }

  const section = { marginTop: 20 }

  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Back */}
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, color: '#8A8578', padding: '12px 0 8px',
        display: 'block',
      }}>← today</button>

      {/* Title */}
      <div style={{ position: 'relative' }}>
        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') titleRef.current?.blur() }}
            style={{
              fontSize: 16, fontWeight: 600, color: '#2D2A26',
              border: 'none', borderBottom: '1px solid #E8E4DC',
              background: 'transparent', outline: 'none', width: '100%',
              padding: '4px 0', fontFamily: 'inherit',
            }}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditingTitle(true)}
            style={{ fontSize: 16, fontWeight: 600, color: '#2D2A26', cursor: 'text', padding: '4px 0' }}>
            {title}{item.scheduled_time ? ` — ${fmtTime(item.scheduled_time)}${item.scheduled_end_time ? `–${fmtTime(item.scheduled_end_time)}` : ''}` : ''}
          </div>
        )}
        {wasTitle && (
          <div style={{ fontSize: 11, color: '#8A8578', fontStyle: 'italic', marginTop: 2 }}>
            was: {wasTitle}
          </div>
        )}
        {saving && <div style={{ fontSize: 11, color: '#B5B0A8', marginTop: 2 }}>saving…</div>}
      </div>

      {/* Context line */}
      {(item.time_type || item.emotional_weight) && (
        <div style={{ fontSize: 11, color: '#8A8578', marginTop: 4 }}>
          {item.time_type === 'A' ? 'Focus' : item.time_type === 'B' ? 'Routine' :
            item.time_type === 'C' ? 'Connection' : item.time_type === 'D' ? 'Restore' :
              item.time_type === '0' ? 'Open' : ''}
          {item.emotional_weight === 'heavy' ? ' · heavy' : ''}
          {item.bounding_type === 'time' ? ' · time-bounded' : ''}
        </div>
      )}

      {/* Steps section */}
      <div style={section}>
        <div
          onClick={() => setShowSteps(!showSteps)}
          style={{ fontSize: 11, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: 8 }}>{showSteps ? '▼' : '▶'}</span>
          Steps
          {!showSteps && steps.length > 0 && <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none' }}>({steps.filter(s => !s.is_completed).length} remaining)</span>}
        </div>
        {showSteps && steps.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '6px 8px', marginBottom: 2,
          }}>
            <Checkbox status={s.is_completed ? 'completed' : 'committed'} onClick={isPast ? undefined : () => !s.is_completed && handleCheckStep(s.id)} />
            <span style={{
              fontSize: 14, flex: 1,
              color: s.is_completed ? '#B5B0A8' : '#2D2A26',
              textDecoration: s.is_completed ? 'line-through' : 'none',
            }}>{s.content}</span>
            <button
              onClick={async () => {
                await fetch(`/api/item-notes/${s.id}`, { method: 'DELETE' })
                setNotes(prev => prev.filter(n => n.id !== s.id))
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#C8C3BB', lineHeight: 1 }}
              title="Delete step"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        ))}
        {showSteps && !isPast && (
          <input
            value={stepInput}
            onChange={e => setStepInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep() } }}
            placeholder={steps.filter(s => !s.is_completed).length === 0 ? "what's next?" : "add step..."}
            style={{ ...inputStyle, marginTop: steps.length > 0 ? 4 : 0 }}
          />
        )}
      </div>

      {/* Notes section */}
      <div style={section}>
        <div style={{ fontSize: 11, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Notes
        </div>
        {notesList.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#B5B0A8', width: 38, flexShrink: 0, paddingTop: 1 }}>
              {fmtNoteTime(n.created_at)}
            </span>
            <span style={{ fontSize: 12, color: '#8A8578' }}>{n.content}</span>
          </div>
        ))}
        {!isPast && (
          <input
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={handleAddNote}
            placeholder="add note..."
            style={{ ...inputStyle, paddingLeft: 46 }}
          />
        )}
      </div>

      {/* Follow-ups for time-locked (meeting) items */}
      {!isPast && isTimeLocked && (
        <div style={section}>
          <div style={{ fontSize: 11, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Follow-ups
          </div>
          <input
            value={followUpInput}
            onChange={e => setFollowUpInput(e.target.value)}
            onKeyDown={handleAddFollowUp}
            placeholder="+ add follow-up..."
            style={inputStyle}
          />
        </div>
      )}

      {/* Inline scheduler */}
      {!isPast && (showScheduler ? (
        <InlineScheduler
          isToday={isToday}
          pickedTime={pickedTime}
          onPickTime={setPickedTime}
          customTime={customTime}
          onCustomTimeChange={setCustomTime}
          onConfirm={async (duration) => {
            const time = pickedTime || parseQuickTime(customTime)
            if (!time) return
            const endTime = duration ? addMinutesHHMM(time, duration) : null
            await onSchedule(item.id, time, endTime)
            setShowScheduler(false)
            setPickedTime(null)
            setCustomTime('')
          }}
          onCancel={() => { setShowScheduler(false); setPickedTime(null); setCustomTime('') }}
        />
      ) : (
        <button onClick={() => {
          // Pre-select current time if already scheduled
          if (item.scheduled_time) setPickedTime(item.scheduled_time.slice(0, 5))
          setShowScheduler(true)
        }} style={{ ...actionBtnStyle, marginTop: 28 }}>
          ⏱ {item.scheduled_time ? 'Reschedule' : 'Schedule this item'}
        </button>
      ))}

      {/* Bottom actions */}
      {isPast ? (
        <div style={{ marginTop: 28, fontSize: 12, color: '#B5B0A8', fontStyle: 'italic' }}>
          {item.completed_date === selectedDate ? '✓ Completed this day' : 'Was on list this day — not completed'}
        </div>
      ) : (
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => onStatusChange(item.id, 'completed').then(onBack)}
          style={actionBtnStyle}>
          → It is done
        </button>
        <button
          onClick={() => onStatusChange(item.id, 'parked').then(onBack)}
          style={actionBtnStyle}>
          → Done working on it today
        </button>
        <button
          onClick={() => onMoveToTomorrow(item.id).then(onBack)}
          style={actionBtnStyle}>
          → Defer to tomorrow
        </button>
        {showCaptureFollowUp ? (
          <input
            value={captureFollowUp}
            onChange={e => setCaptureFollowUp(e.target.value)}
            onKeyDown={async e => {
              if (e.key !== 'Enter' || !captureFollowUp.trim()) return
              e.preventDefault()
              await onMarkDoneAndCapture(item.id, captureFollowUp.trim())
              onBack()
            }}
            onBlur={() => { if (!captureFollowUp.trim()) setShowCaptureFollowUp(false) }}
            placeholder="what's the follow-up?"
            style={{ ...inputStyle, fontSize: 13 }}
            autoFocus
          />
        ) : (
          <button onClick={() => setShowCaptureFollowUp(true)} style={actionBtnStyle}>
            → Done, needs follow-up
          </button>
        )}
        {item.scheduled_time ? (
          <button
            onClick={() => onUnschedule(item.id).then(onBack)}
            style={actionBtnStyle}>
            ↺ Unschedule
          </button>
        ) : (
          <button
            onClick={() => onStatusChange(item.id, 'rescheduled').then(onBack)}
            style={actionBtnStyle}>
            ↺ Put it back in the hopper
          </button>
        )}
        <button
          onClick={() => onStatusChange(item.id, 'skipped').then(onBack)}
          style={actionBtnStyle}>
          ✕ Never getting done
        </button>
        <button
          onClick={() => { if (window.confirm('Delete this item permanently?')) onDelete(item.id).then(onBack) }}
          style={{ ...actionBtnStyle, color: '#C4725A' }}>
          ⌫ Delete like it never happened
        </button>
      </div>
      )}

      {/* Next up reminder */}
      {nextUp && isToday && (
        <div style={{ marginTop: 24, fontSize: 12, color: '#8A8578' }}>
          Next up: {nextUp.name}{nextUp.scheduled_time ? ` at ${fmtTime(nextUp.scheduled_time)}` : ''}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: 'none', borderBottom: '1px solid #F0EDE6',
  background: 'transparent', outline: 'none', fontSize: 14, color: '#2D2A26',
  padding: '6px 0', fontFamily: 'inherit', boxSizing: 'border-box',
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: '#8A8578', textAlign: 'left', padding: 0,
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
  background: 'none', border: 'none', borderBottom: '1px solid #F0EDE6',
  cursor: 'pointer', fontSize: 13, color: '#2D2A26', fontFamily: 'inherit',
}

// ─── CompletedDayView ─────────────────────────────────────────────────────────

const MOOD_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Drained', color: '#C4504A' },
  2: { label: 'Tough', color: '#D4885A' },
  3: { label: 'Okay', color: '#B5B0A8' },
  4: { label: 'Good', color: '#6BA07A' },
  5: { label: 'Great', color: '#4A8B5E' },
}

function CompletedDayView({
  items, loggedItems, dayCompletion, onReopen,
}: {
  items: ActionItemWithNotes[]
  loggedItems: { id: string; note: string; metadata: any; created_at: string }[]
  dayCompletion: DayCompletion
  onReopen: () => void
}) {
  const completedItems = items.filter(i => i.status === 'completed')
  const skippedItems = items.filter(i => i.status === 'skipped')
  const otherItems = items.filter(i => i.status !== 'completed' && i.status !== 'skipped')

  const mood = dayCompletion.mood ? MOOD_LABELS[dayCompletion.mood] : null

  const sectionHead: React.CSSProperties = {
    fontSize: 11, color: '#B5B0A8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 20,
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Day closed header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8A857D' }}>Day closed</span>
        {mood && <span style={{ fontSize: 12, color: mood.color }}>{mood.label}</span>}
        <span style={{ flex: 1 }} />
        <button onClick={onReopen} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: '#B5B0A8', padding: 0,
        }}>
          Reopen this day
        </button>
      </div>

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div>
          <div style={sectionHead}>Done</div>
          {completedItems.map(item => (
            <div key={item.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, background: '#8A857D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: 10 }}>✓</span>
              <span style={{ fontSize: 14, color: '#8A857D', textDecoration: 'line-through' }}>{item.name}</span>
              {item.scheduled_time && <span style={{ fontSize: 11, color: '#B5B0A8', marginLeft: 'auto' }}>{fmtTime(item.scheduled_time)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Skipped items */}
      {skippedItems.length > 0 && (
        <div>
          <div style={sectionHead}>Skipped</div>
          {skippedItems.map(item => (
            <div key={item.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, border: '1.5px solid #B5B0A8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#B5B0A8', fontSize: 10, fontWeight: 700 }}>✕</span>
              <span style={{ fontSize: 14, color: '#B5B0A8' }}>{item.name}</span>
              {item.scheduled_time && <span style={{ fontSize: 11, color: '#B5B0A8', marginLeft: 'auto' }}>{fmtTime(item.scheduled_time)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Remaining (parked, in_progress, committed — leftovers) */}
      {otherItems.length > 0 && (
        <div>
          <div style={sectionHead}>Incomplete</div>
          {otherItems.map(item => (
            <div key={item.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 2, border: '1.5px solid #B5B0A8', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: '#B5B0A8' }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Logged items */}
      {loggedItems.length > 0 && (
        <div>
          <div style={sectionHead}>Logged</div>
          {loggedItems.map(entry => (
            <div key={entry.id} style={{ padding: '3px 0', display: 'flex', gap: 8, fontSize: 13, color: '#8A8578' }}>
              <span style={{ fontSize: 11, color: '#B5B0A8', flexShrink: 0 }}>{fmtNoteTime(entry.created_at)}</span>
              <span>{entry.metadata?.cleanedName ?? entry.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reflection */}
      {(dayCompletion.wins || dayCompletion.friction || dayCompletion.journal) && (
        <div style={{ marginTop: 24, borderTop: '1px solid #F0EDE6', paddingTop: 16 }}>
          {dayCompletion.wins && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionHead}>Wins</div>
              <div style={{ fontSize: 13, color: '#2D2A26', whiteSpace: 'pre-wrap' }}>{dayCompletion.wins}</div>
            </div>
          )}
          {dayCompletion.friction && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionHead}>Friction</div>
              <div style={{ fontSize: 13, color: '#2D2A26', whiteSpace: 'pre-wrap' }}>{dayCompletion.friction}</div>
            </div>
          )}
          {dayCompletion.journal && (
            <div style={{ marginBottom: 12 }}>
              <div style={sectionHead}>Journal</div>
              <div style={{ fontSize: 13, color: '#2D2A26', whiteSpace: 'pre-wrap' }}>{dayCompletion.journal}</div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Main TodayPage ───────────────────────────────────────────────────────────

interface Props {
  userId: string
  displayName: string
}

interface DayCompletion {
  id: string
  completion_date: string
  mood: number | null
  wins: string | null
  friction: string | null
  journal: string | null
  completed_at: string
}

export default function TodayPage({ displayName }: Props) {
  const router = useRouter()
  const todayStr = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [items, setItems] = useState<ActionItemWithNotes[]>([])
  const [loggedItems, setLoggedItems] = useState<{ id: string; note: string; metadata: any; created_at: string }[]>([])
  const [nextUp, setNextUp] = useState<ActionItemWithNotes | null>(null)
  const [dayCompletion, setDayCompletion] = useState<DayCompletion | null>(null)
  const [reopened, setReopened] = useState(false)
  const [focusItemId, setFocusItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowTime, setNowTime] = useState(currentTimeStr())
  const [hopperItems, setHopperItems] = useState<HopperItem[]>([])
  const [suggestedData, setSuggestedData] = useState<SuggestedData | null>(null)
  const [dismissedVirtualIds, setDismissedVirtualIds] = useState<Set<string>>(new Set())
  const [yesterdayUnfinished, setYesterdayUnfinished] = useState<ActionItemWithNotes[]>([])

  const isToday = selectedDate === todayStr
  const isPast = selectedDate < todayStr
  const isYesterday = selectedDate === addDays(todayStr, -1)
  const isTomorrow = selectedDate === addDays(todayStr, 1)

  // Update "now" time every minute
  useEffect(() => {
    const interval = setInterval(() => setNowTime(currentTimeStr()), 60000)
    return () => clearInterval(interval)
  }, [])

  const loadData = useCallback(async (date: string) => {
    setLoading(true)
    setReopened(false)
    try {
      const [todayRes, dcRes] = await Promise.all([
        fetch(`/api/today?date=${date}`),
        fetch(`/api/day-completion?date=${date}`),
      ])
      const data = await todayRes.json()
      const dcData = await dcRes.json()
      setItems(data.items ?? [])
      setLoggedItems(data.loggedItems ?? [])
      setNextUp(data.nextUp ?? null)
      setDayCompletion(dcData?.id ? dcData : null)
      setHopperItems(data.hopperItems ?? [])
      setSuggestedData(data.suggestedData ?? null)
      setDismissedVirtualIds(new Set())
      setYesterdayUnfinished(data.yesterdayUnfinished ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate, loadData])

  // Derived — skipped scheduled items float up to the todo section
  const todoItems = items
    .filter(i => !i.scheduled_time || i.status === 'skipped')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const scheduleItems = items
    .filter(i => !!i.scheduled_time && i.status !== 'skipped')
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))

  const stats = {
    done: items.filter(i => i.status === 'completed').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
    scheduled: items.filter(i => i.status === 'committed' && i.scheduled_time).length,
    todo: items.filter(i => i.status === 'committed' && !i.scheduled_time).length,
    skipped: items.filter(i => i.status === 'skipped').length,
  }

  const focusItem = items.find(i => i.id === focusItemId) ?? null

  // Next up for today list view (upcoming time-locked, not yet past)
  const listNextUp = isToday ? items
    .filter(i => i.scheduled_time && i.status !== 'completed' && i.status !== 'skipped')
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    .find(i => (i.scheduled_time ?? '') > nowTime) ?? null : null

  // Next up for focus view — excludes the focused item, computed from live items
  const focusNextUp = isToday && focusItemId ? items
    .filter(i => i.scheduled_time && i.status !== 'completed' && i.status !== 'skipped' && i.id !== focusItemId)
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    .find(i => (i.scheduled_time ?? '') > nowTime) ?? null : null

  // Filter logged items to only those whose created_at falls on the selected local date
  const filteredLoggedItems = loggedItems.filter(entry => {
    const localDate = toDateStr(new Date(entry.created_at))
    return localDate === selectedDate
  })

  // ─── Hopper: This Week + Suggested ───────────────────────────────────────────

  const showHopperSections = selectedDate >= todayStr

  // Normalize hopper items (apply activity fields)
  const normalizedHopper: HopperItem[] = useMemo(() =>
    hopperItems.map(h => ({
      ...h,
      time_type: h.activity?.time_type ?? h.time_type ?? 'B',
      emotional_weight: h.activity?.emotional_weight ?? h.emotional_weight ?? 'normal',
    }))
  , [hopperItems])

  // Compute suggested items from activities + coverage (same logic as OrganizeWeekModal)
  const suggestedItems: SuggestedItem[] = useMemo(() => {
    if (!suggestedData) return []
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // Current week boundaries (Mon–Sun)
    const weekStartDate = new Date(suggestedData.weekStart + 'T00:00:00')
    const weekEndDate = new Date(weekStartDate); weekEndDate.setDate(weekEndDate.getDate() + 7)

    // Build set of activity_ids already scheduled this week (from coverage data)
    const scheduledThisWeek = new Set<string>()
    for (const { activity_id, committed_date } of suggestedData.coverage) {
      const d = new Date(committed_date + 'T00:00:00')
      if (d >= weekStartDate && d < weekEndDate) scheduledThisWeek.add(activity_id)
    }

    // Also check items in current view (today's committed/in_progress items)
    for (const item of items) {
      const aid = (item as ActionItemWithNotes & { activity_id?: string }).activity_id
      if (!aid) continue
      const cd = (item as ActionItemWithNotes & { committed_date?: string }).committed_date
      if (cd) {
        const d = new Date(cd + 'T00:00:00')
        if (d >= weekStartDate && d < weekEndDate) scheduledThisWeek.add(aid)
      } else {
        // Item visible on today without committed_date — count as this week
        scheduledThisWeek.add(aid)
      }
    }

    // Build coverage map for cadence window check (for activities NOT caught by week check)
    const coverageMap: Record<string, Date[]> = {}
    for (const { activity_id, committed_date } of suggestedData.coverage) {
      if (!coverageMap[activity_id]) coverageMap[activity_id] = []
      coverageMap[activity_id].push(new Date(committed_date + 'T00:00:00'))
    }

    // Activities already in the hopper shouldn't appear in Suggested
    const hopperActivityIds = new Set(hopperItems.filter(h => h.activity_id).map(h => h.activity_id!))
    const dismissedSet = new Set(suggestedData.dismissedActivityIds)

    return suggestedData.activities
      .filter(a => a.frequency && CADENCE_DAYS[a.frequency])
      .filter(a => !hopperActivityIds.has(a.id))
      .filter(a => !dismissedSet.has(a.id) && !dismissedVirtualIds.has(a.id))
      // Primary check: already scheduled this week — suppress
      .filter(a => !scheduledThisWeek.has(a.id))
      // Secondary check: cadence window (covers "done recently, don't suggest yet")
      .filter(a => {
        const cadenceDays = CADENCE_DAYS[a.frequency!]
        const windowMs = cadenceDays * 24 * 60 * 60 * 1000
        const dates = coverageMap[a.id] ?? []
        return !dates.some(d => Math.abs(d.getTime() - today.getTime()) <= windowMs)
      })
      .map(a => ({
        id: `activity:${a.id}`,
        name: a.name,
        time_type: a.time_type,
        emotional_weight: a.emotional_weight,
        activity_id: a.id,
        preferred_time: a.preferred_time,
        frequency: a.frequency,
        duration_min: a.duration_range_min ?? 30,
        duration_max: a.duration_range_max ?? 60,
      }))
      .sort((a, b) => {
        const PT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
        const ao = a.preferred_time ? (PT_ORDER[a.preferred_time] ?? 3) : 3
        const bo = b.preferred_time ? (PT_ORDER[b.preferred_time] ?? 3) : 3
        if (ao !== bo) return ao - bo
        return a.name.localeCompare(b.name)
      })
  }, [suggestedData, items, hopperItems, dismissedVirtualIds])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async function handleDeleteLogEntry(id: string) {
    setLoggedItems(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/action-log/${id}`, { method: 'DELETE' })
  }

  async function handleStatusChange(id: string, status: string) {
    // Optimistic update — preserve all existing fields, only change status
    setItems(prev => {
      if (status === 'rescheduled') {
        // Server converts to 'candidate' and clears schedule — remove from today list
        return prev.filter(i => i.id !== id)
      }
      return prev.map(i => {
        if (i.id !== id) return i
        return { ...i, status: status as ActionItemWithNotes['status'] }
      })
    })

    const res = await fetch(`/api/action-items/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (data.item) {
      // Reconcile — keep local item_notes since the status route doesn't return them
      setItems(prev => prev.map(i => {
        if (i.id !== id) return i
        const { item_notes, ...serverFields } = data.item
        return {
          ...i,
          ...serverFields,
          scheduled_time: serverFields.scheduled_time ?? i.scheduled_time,
          scheduled_end_time: serverFields.scheduled_end_time ?? i.scheduled_end_time,
          item_notes: item_notes ?? i.item_notes,
        }
      }))
    }
  }

  async function handleCheckboxCycle(item: ActionItemWithNotes) {
    const next =
      item.status === 'committed' ? 'in_progress' :
        item.status === 'in_progress' ? 'completed' :
          item.status === 'completed' ? 'committed' :
            item.status === 'parked' ? 'in_progress' :
              item.status === 'skipped' ? 'committed' : 'committed'
    await handleStatusChange(item.id, next)
  }

  async function handleTitleChange(id: string, name: string) {
    const res = await fetch(`/api/action-items/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (data.item) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...data.item } : i))
    }
    return { oldTitleNote: data.oldTitleNote }
  }

  async function handleAddNote(actionItemId: string, noteType: 'note' | 'step', content: string): Promise<ItemNote> {
    const res = await fetch('/api/item-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: actionItemId, note_type: noteType, content }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `Failed to save ${noteType}`)
    }
    const note = await res.json()
    setItems(prev => prev.map(i => i.id === actionItemId
      ? { ...i, item_notes: [...(i.item_notes ?? []), note] }
      : i))
    return note
  }

  async function handleCompleteStep(noteId: string) {
    await fetch(`/api/item-notes/${noteId}/complete`, { method: 'PATCH' })
    setItems(prev => prev.map(i => ({
      ...i,
      item_notes: (i.item_notes ?? []).map(n => n.id === noteId ? { ...n, is_completed: true } : n),
    })))
  }

  async function handleMarkDoneAndCapture(id: string, followUpText: string) {
    await handleStatusChange(id, 'completed')
    const res = await fetch('/api/today/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: followUpText, source_action_item_id: id }),
    })
    const data = await res.json()
    if (data.actionItem) {
      setItems(prev => [...prev, data.actionItem])
    }
  }

  async function handleMoveToTomorrow(id: string) {
    const item = items.find(i => i.id === id)
    // Delete the old time_block first to prevent orphan reconciliation creating duplicates
    if (item?.time_block_id) {
      await fetch(`/api/time-blocks/${item.time_block_id}`, { method: 'DELETE' })
    }
    const tomorrow = addDays(todayStr, 1)
    const res = await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ committed_date: tomorrow, scheduled_time: null, scheduled_end_time: null, time_block_id: null }),
    })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }

  // ── Yesterday's unfinished triage actions ──────────────────────────────────

  async function handleYesterdayDidIt(id: string) {
    // Mark complete with yesterday's date
    const yesterday = addDays(todayStr, -1)
    await fetch(`/api/action-items/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', committed_date: yesterday }),
    })
    setYesterdayUnfinished(prev => prev.filter(i => i.id !== id))
  }

  async function handleYesterdaySkip(id: string) {
    await fetch(`/api/action-items/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'skipped' }),
    })
    setYesterdayUnfinished(prev => prev.filter(i => i.id !== id))
  }

  async function handleYesterdayMoveToToday(id: string) {
    const item = yesterdayUnfinished.find(i => i.id === id)
    if (!item) return
    // Delete old time_block to prevent orphan issues
    if (item.time_block_id) {
      await fetch(`/api/time-blocks/${item.time_block_id}`, { method: 'DELETE' })
    }
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ committed_date: todayStr, scheduled_time: null, scheduled_end_time: null, time_block_id: null }),
    })
    setYesterdayUnfinished(prev => prev.filter(i => i.id !== id))
    setItems(prev => [...prev, { ...item, committed_date: todayStr, scheduled_time: null, scheduled_end_time: null, time_block_id: null }])
  }

  async function handleAddFollowUp(content: string, sourceId: string) {
    await fetch('/api/today/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: content, parent_action_item_id: sourceId }),
    })
  }

  async function handleUnschedule(id: string) {
    const item = items.find(i => i.id === id)

    // Optimistic update — move to todo section immediately
    setItems(prev => prev.map(i => i.id === id
      ? { ...i, scheduled_time: null, scheduled_end_time: null, time_block_id: null }
      : i))

    // Delete the linked time_block
    if (item?.time_block_id) {
      await fetch(`/api/time-blocks/${item.time_block_id}`, { method: 'DELETE' })
    }

    // Clear schedule fields on the action_item, keep committed_date
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_time: null, scheduled_end_time: null, time_block_id: null }),
    })
  }

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id)
    // Delete associated time_block first to prevent orphan reconciliation
    if (item?.time_block_id) {
      await fetch(`/api/time-blocks/${item.time_block_id}`, { method: 'DELETE' })
    }
    const res = await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }

  async function handleSchedule(id: string, time: string, endTime: string | null) {
    // Optimistic update — move to schedule section immediately
    setItems(prev => prev.map(i => i.id === id
      ? { ...i, scheduled_time: time, scheduled_end_time: endTime }
      : i))

    // Close focus view — item now appears in the schedule section
    setFocusItemId(null)

    // Find the item to get its name and committed_date for the time_block
    const item = items.find(i => i.id === id)
    const blockDate = item?.committed_date ?? selectedDate

    // If item already has a time_block, update it; otherwise create a new one
    let timeBlock: { id: string } | null = null
    if (item?.time_block_id) {
      const tbRes = await fetch(`/api/time-blocks/${item.time_block_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: time,
          end_time: endTime,
        }),
      })
      timeBlock = tbRes.ok ? { id: item.time_block_id } : null
    } else {
      const tbRes = await fetch('/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: blockDate,
          label: item?.name ?? '',
          start_time: time,
          end_time: endTime,
          time_type: item?.time_type ?? 'B',
          source: 'manual',
        }),
      })
      timeBlock = tbRes.ok ? await tbRes.json() : null
    }

    // Update the action_item with scheduled_time, time_block_id, and ensure status is committed
    const update: Record<string, unknown> = { scheduled_time: time, status: 'committed' }
    if (endTime) update.scheduled_end_time = endTime
    if (timeBlock?.id) update.time_block_id = timeBlock.id

    const res = await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (res.ok) {
      const data = await res.json()
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...data, item_notes: i.item_notes } : i))
    }
  }

  // ─── Hopper mutations ────────────────────────────────────────────────────────

  async function handleCommitHopper(itemId: string) {
    // Optimistic: remove from hopper
    setHopperItems(prev => prev.filter(h => h.id !== itemId))

    await fetch(`/api/action-items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'committed', committed_date: selectedDate }),
    })
    // Reload to get the item in the committed list
    loadData(selectedDate)
  }

  async function handleCommitSuggested(virtualId: string) {
    const activityId = virtualId.slice('activity:'.length)
    const activity = suggestedData?.activities.find(a => a.id === activityId)
    // Optimistic: hide from suggested
    setDismissedVirtualIds(prev => new Set([...prev, activityId]))

    const createRes = await fetch('/api/action-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: activity?.name ?? activityId,
        source: 'template_proposal',
        activity_id: activityId,
        status: 'committed',
        committed_date: selectedDate,
        committed_at: new Date().toISOString(),
      }),
    })
    if (createRes.ok) {
      loadData(selectedDate)
    }
  }

  async function handleAutoPlaceHopper(itemId: string, overrides: { preferred_time: string; duration_minutes: number }, force: boolean) {
    let actionItemId = itemId

    // Virtual items need a DB record first
    if (itemId.startsWith('activity:')) {
      const activityId = itemId.slice('activity:'.length)
      const activity = suggestedData?.activities.find(a => a.id === activityId)
      setDismissedVirtualIds(prev => new Set([...prev, activityId]))

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
    } else {
      setHopperItems(prev => prev.filter(h => h.id !== itemId))
    }

    // Compute week_start (Monday of the selected date's week)
    const d = new Date(selectedDate + 'T12:00:00')
    const day = d.getDay()
    const daysToMon = day === 0 ? 6 : day - 1
    const monday = new Date(d); monday.setDate(monday.getDate() - daysToMon)
    const weekStart = toDateStr(monday)

    await fetch('/api/action-items/auto-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_item_id: actionItemId, week_start: weekStart, utc_offset_minutes: new Date().getTimezoneOffset(), force, ...overrides }),
    })
    loadData(selectedDate)
  }

  async function handlePostponeHopper(id: string, newDate: string) {
    setHopperItems(prev => prev.filter(h => h.id !== id))
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposed_date: newDate }),
    })
  }

  async function handleDismissHopper(id: string) {
    if (id.startsWith('activity:')) {
      const activityId = id.slice('activity:'.length)
      const activity = suggestedData?.activities.find(a => a.id === activityId)
      setDismissedVirtualIds(prev => new Set([...prev, activityId]))
      // Persist the dismissal
      fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activity?.name ?? activityId,
          source: 'template_proposal',
          activity_id: activityId,
          status: 'dismissed',
          metadata: { dismissed_week: suggestedData?.weekStart },
        }),
      })
    } else {
      setHopperItems(prev => prev.filter(h => h.id !== id))
      await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', resolved_at: new Date().toISOString() }),
      })
    }
  }

  async function handleLogHopper(id: string, name: string) {
    setHopperItems(prev => prev.filter(h => h.id !== id))
    await fetch('/api/action-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'logged', event_date: selectedDate, note: name, action_item_id: id }),
    })
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    loadData(selectedDate)
  }

  async function handleDeleteHopper(id: string) {
    setHopperItems(prev => prev.filter(h => h.id !== id))
    await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    maxWidth: 860, padding: '0 20px', marginLeft: 40,
    fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif',
    fontSize: 14, color: '#2D2A26', background: '#FAFAF7', minHeight: '100vh',
  }

  return (
      <div style={pageStyle}>
        {focusItem ? (
          <FocusView
            item={focusItem}
            onBack={() => setFocusItemId(null)}
            onStatusChange={handleStatusChange}
            onTitleChange={handleTitleChange}
            onAddNote={handleAddNote}
            onCompleteStep={handleCompleteStep}
            onAddFollowUp={handleAddFollowUp}
            onMoveToTomorrow={handleMoveToTomorrow}
            onMarkDoneAndCapture={handleMarkDoneAndCapture}
            onDelete={handleDelete}
            onSchedule={handleSchedule}
            onUnschedule={handleUnschedule}
            nextUp={focusNextUp ?? listNextUp}
            isToday={isToday}
            isPast={isPast}
            selectedDate={selectedDate}
          />
        ) : (
          <>
            {/* Day tabs */}
            <div style={{ display: 'flex', gap: 20, paddingTop: 16, paddingBottom: 8 }}>
              <span
                onClick={() => setSelectedDate(addDays(todayStr, -1))}
                style={{
                  fontSize: 14, cursor: 'pointer',
                  color: isYesterday ? '#B8443E' : '#8A8578',
                  fontWeight: isYesterday ? 700 : 400,
                }}>
                Yesterday
              </span>
              <span
                onClick={() => setSelectedDate(todayStr)}
                style={{
                  fontSize: 14, cursor: 'pointer',
                  color: isToday ? '#2D2A26' : '#8A8578',
                  fontWeight: isToday ? 700 : 400,
                }}>
                Today
              </span>
              <span
                onClick={() => setSelectedDate(addDays(todayStr, 1))}
                style={{
                  fontSize: 14, cursor: 'pointer',
                  color: isTomorrow ? '#4B6A82' : '#8A8578',
                  fontWeight: isTomorrow ? 700 : 400,
                }}>
                Tomorrow
              </span>
            </div>

            {/* Capture — only on today and future views */}
            {!isPast && (
              <CaptureInput
                source="today"
                onItemCreated={item => setItems(prev => [...prev, item])}
                onLogEntry={() => loadData(selectedDate)}
              />
            )}

            {loading ? (
              <div style={{ fontSize: 12, color: '#B5B0A8', paddingTop: 20 }}>Loading…</div>
            ) : dayCompletion && !reopened ? (
              <CompletedDayView
                items={items}
                loggedItems={filteredLoggedItems}
                dayCompletion={dayCompletion}
                onReopen={() => setReopened(true)}
              />
            ) : (
              <>
                {/* Next up */}
                {listNextUp && (
                  <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 4 }}>
                    Next up: {listNextUp.name}{listNextUp.scheduled_time ? ` at ${fmtTime(listNextUp.scheduled_time)}` : ''}
                  </div>
                )}

                {/* Stats */}
                <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 12 }}>
                  {stats.done} done{stats.inProgress > 0 ? ` · ${stats.inProgress} in progress` : ''}{stats.scheduled > 0 ? ` · ${stats.scheduled} scheduled` : ''}{stats.todo > 0 ? ` · ${stats.todo} to-do` : ''}{stats.skipped > 0 ? ` · ${stats.skipped} skipped` : ''}
                </div>

                {/* Yesterday's unfinished — triage box */}
                {isToday && yesterdayUnfinished.length > 0 && (
                  <div style={{
                    marginBottom: 16, padding: '10px 12px', borderRadius: 8,
                    background: '#FBF9F5', border: '1px solid #E8E4DC',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Yesterday&apos;s unfinished
                    </div>
                    {yesterdayUnfinished.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 0', borderBottom: '1px solid #F0EDE8',
                      }}>
                        <span style={{ fontSize: 13, color: '#2D2A26', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#B5B0A8', flexShrink: 0 }}>
                          {item.scheduled_time ? fmtTime(item.scheduled_time) : ''}
                        </span>
                        <button
                          onClick={() => handleYesterdayDidIt(item.id)}
                          title="I did it"
                          style={{ background: 'none', border: '1px solid #8A857D', borderRadius: 3, cursor: 'pointer', fontSize: 9, color: '#5A9E6F', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >✓</button>
                        <button
                          onClick={() => handleYesterdaySkip(item.id)}
                          title="Didn't happen"
                          style={{ background: 'none', border: '1px solid #8A857D', borderRadius: 3, cursor: 'pointer', fontSize: 9, color: '#C4725A', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >✕</button>
                        <button
                          onClick={() => handleYesterdayMoveToToday(item.id)}
                          title="Move to today"
                          style={{ background: 'none', border: '1px solid #8A857D', borderRadius: 3, cursor: 'pointer', fontSize: 9, color: '#4B6A82', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >→</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Two-column layout: schedule left, todos right (desktop); schedule first on mobile */}
                <style>{`
                  .today-columns { display: flex; flex-direction: column; }
                  @media (min-width: 768px) {
                    .today-columns { flex-direction: row; gap: 24px; }
                    .today-col-schedule { flex: 1; min-width: 0; }
                    .today-col-todo { flex: 1; min-width: 0; }
                  }
                `}</style>
                <div className="today-columns">
                  {/* Schedule column */}
                  <div className="today-col-schedule">
                    {scheduleItems.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        {renderScheduleItems(scheduleItems, nowTime, isToday, handleCheckboxCycle, setFocusItemId, handleStatusChange, isPast, selectedDate)}
                      </div>
                    )}
                  </div>

                  {/* To-do column */}
                  <div className="today-col-todo">
                    {todoItems.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        {todoItems.map(item => (
                          <TodoRow
                            key={item.id}
                            item={item}
                            isPast={isPast}
                            selectedDate={selectedDate}
                            onCheckbox={() => handleCheckboxCycle(item)}
                            onFocus={() => setFocusItemId(item.id)}
                            onReschedule={() => handleStatusChange(item.id, 'rescheduled')}
                            onSkip={() => handleStatusChange(item.id, 'skipped')}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {todoItems.length === 0 && scheduleItems.length === 0 && (
                  <div style={{ fontSize: 12, color: '#B5B0A8', paddingTop: 20 }}>
                    Nothing scheduled for this day.
                  </div>
                )}

                {/* This Week + Suggested hopper sections */}
                {showHopperSections && (normalizedHopper.length > 0 || suggestedItems.length > 0) && (
                  <div style={{ marginTop: 24 }}>
                    {normalizedHopper.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: '#B5B0A8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          This Week
                        </div>
                        {normalizedHopper.slice(0, 5).map(item => (
                          <HopperRow
                            key={item.id}
                            item={item}
                            isVirtual={false}
                            onCommit={() => handleCommitHopper(item.id)}
                            onAutoPlace={(overrides, force) => handleAutoPlaceHopper(item.id, overrides, force)}
                            onTimeShift={(date) => handlePostponeHopper(item.id, date)}
                            onDismiss={() => handleDismissHopper(item.id)}
                            onLog={() => handleLogHopper(item.id, item.name)}
                            onDelete={() => handleDeleteHopper(item.id)}
                          />
                        ))}
                        {normalizedHopper.length > 5 && (
                          <div style={{ fontSize: 11, color: '#B5B0A8', padding: '4px 0' }}>
                            +{normalizedHopper.length - 5} more in hopper
                          </div>
                        )}
                      </>
                    )}

                    {suggestedItems.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: '#B5B0A8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: normalizedHopper.length > 0 ? 16 : 0 }}>
                          Suggested
                        </div>
                        {suggestedItems.slice(0, 5).map(item => (
                          <HopperRow
                            key={item.id}
                            item={{
                              id: item.id,
                              name: item.name,
                              source: 'template_proposal',
                              time_type: item.time_type,
                              emotional_weight: item.emotional_weight,
                              priority_tier: 'suggested',
                              priority_score: 0,
                              activity_id: item.activity_id,
                            }}
                            isVirtual={true}
                            onCommit={() => handleCommitSuggested(item.id)}
                            onAutoPlace={(overrides, force) => handleAutoPlaceHopper(item.id, overrides, force)}
                            onDismiss={() => handleDismissHopper(item.id)}
                          />
                        ))}
                        {suggestedItems.length > 5 && (
                          <div style={{ fontSize: 11, color: '#B5B0A8', padding: '4px 0' }}>
                            +{suggestedItems.length - 5} more suggested
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Logged items */}
                {filteredLoggedItems.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#B5B0A8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Logged
                    </div>
                    {filteredLoggedItems.map(entry => (
                      <div key={entry.id} style={{
                        fontSize: 13, color: '#8A8578', padding: '4px 0',
                        borderBottom: '1px solid #F8F7F4',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ fontSize: 11, color: '#B5B0A8', flexShrink: 0 }}>
                          {fmtNoteTime(entry.created_at)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>{entry.metadata?.cleanedName ?? entry.note}</span>
                        <button
                          onClick={() => handleDeleteLogEntry(entry.id)}
                          title="Delete"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#B5B0A8', fontSize: 13, padding: '0 4px',
                            minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </>
            )}
          </>
        )}
      </div>
  )
}

// ─── TodoRow ─────────────────────────────────────────────────────────────────

function TodoRow({
  item, isPast, selectedDate, onCheckbox, onFocus, onReschedule, onSkip,
}: {
  item: ActionItemWithNotes
  isPast?: boolean
  selectedDate?: string
  onCheckbox: () => void
  onFocus: () => void
  onReschedule: () => void
  onSkip: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showSteps, setShowSteps] = useState(true)
  const menuOpenedAt = useRef(0)
  // For past views, derive display status from completed_date
  const displayCompleted = isPast && selectedDate ? item.completed_date === selectedDate : item.status === 'completed'
  const isCompleted = displayCompleted
  const isParked = item.status === 'parked'
  const isSkipped = item.status === 'skipped'
  const muted = isCompleted || isParked || isSkipped || (isPast && !isCompleted)

  const steps = (item.item_notes ?? [])
    .filter(n => n.note_type === 'step')
    .sort((a, b) => a.sort_order - b.sort_order)
  const notes = (item.item_notes ?? [])
    .filter(n => n.note_type === 'note')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div
      onClick={onFocus}
      style={{
        padding: '5px 0', cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid #F8F7F4',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Checkbox status={isCompleted ? 'completed' : isPast ? 'committed' : item.status} onClick={isPast ? undefined : onCheckbox} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 14,
            color: muted ? '#B5B0A8' : '#2D2A26',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}>
            {item.name}
          </span>
        </div>
      </div>
      {steps.length > 0 && item.status === 'in_progress' && (
        <div style={{ paddingLeft: 22, marginTop: 3 }}>
          <div
            onClick={e => { e.stopPropagation(); setShowSteps(!showSteps) }}
            style={{ fontSize: 10, color: '#B5B0A8', cursor: 'pointer', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <span style={{ fontSize: 7 }}>{showSteps ? '▼' : '▶'}</span>
            {showSteps ? 'steps' : `${steps.filter(s => !s.is_completed).length} of ${steps.length} steps remaining`}
          </div>
          {showSteps && steps.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 1, flexShrink: 0,
                border: s.is_completed ? 'none' : '1px solid #C8C3BB',
                background: s.is_completed ? '#C8C3BB' : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.is_completed && <span style={{ fontSize: 7, color: 'white', lineHeight: 1 }}>✓</span>}
              </span>
              <span style={{
                fontSize: 12, color: s.is_completed ? '#C8C3BB' : '#8A8578',
                textDecoration: s.is_completed ? 'line-through' : 'none',
              }}>{s.content}</span>
            </div>
          ))}
        </div>
      )}
      {notes.length > 0 && item.status === 'in_progress' && (
        <div style={{ paddingLeft: 22, marginTop: 3 }}>
          {notes.map(n => (
            <div key={n.id} style={{ fontSize: 11, color: '#8A8578', marginBottom: 2, lineHeight: 1.4 }}>
              {n.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ScheduleRow ──────────────────────────────────────────────────────────────

function ScheduleRow({ item, isPast, selectedDate, onCheckbox, onFocus, onReschedule, onSkip }: {
  item: ActionItemWithNotes
  isPast?: boolean
  selectedDate?: string
  onCheckbox: () => void
  onFocus: () => void
  onReschedule: () => void
  onSkip: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const displayCompleted = isPast && selectedDate ? item.completed_date === selectedDate : item.status === 'completed'
  const isCompleted = displayCompleted
  const isParked = item.status === 'parked'
  const isSkipped = item.status === 'skipped'
  const muted = isCompleted || isParked || isSkipped || (isPast && !isCompleted)

  return (
    <div
      onClick={onFocus}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '5px 0', cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid #F8F7F4',
      }}
    >
      <span style={{ fontSize: 12, color: '#8A8578', width: 44, flexShrink: 0, textAlign: 'right', paddingTop: 1 }}>
        {item.scheduled_time ? fmtTime(item.scheduled_time) : ''}
      </span>
      <Checkbox status={isCompleted ? 'completed' : isPast ? 'committed' : item.status} onClick={isPast ? undefined : onCheckbox} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 14,
          color: muted ? '#B5B0A8' : '#2D2A26',
          textDecoration: isCompleted ? 'line-through' : 'none',
        }}>
          {item.name}
        </span>
      </div>
    </div>
  )
}

// ─── Schedule section renderer ────────────────────────────────────────────────

function renderScheduleItems(
  items: ActionItemWithNotes[],
  nowTime: string,
  isToday: boolean,
  onCheckbox: (item: ActionItemWithNotes) => void,
  onFocus: (id: string) => void,
  onStatusChange: (id: string, status: string) => void,
  isPast?: boolean,
  selectedDate?: string,
) {
  const result: React.ReactNode[] = []
  let nowLineInserted = false

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemTime = item.scheduled_time?.slice(0, 5) ?? ''

    // Insert "now" line between past and future items (today only)
    if (isToday && !nowLineInserted && itemTime > nowTime) {
      nowLineInserted = true
      const currentItem = items.find(it => {
        const start = it.scheduled_time?.slice(0, 5) ?? ''
        const end = it.scheduled_end_time?.slice(0, 5) ?? ''
        return start <= nowTime && end > nowTime
      })
      result.push(
        <div key="now-line" style={{
          fontSize: 12, color: '#C4725A', margin: '6px 0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
          <span>{fmtTime(nowTime)}{currentItem ? ` ${currentItem.name}` : ''}</span>
          <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
        </div>
      )
    }

    result.push(
      <ScheduleRow
        key={item.id}
        item={item}
        isPast={isPast}
        selectedDate={selectedDate}
        onCheckbox={() => onCheckbox(item)}
        onFocus={() => onFocus(item.id)}
        onReschedule={() => onStatusChange(item.id, 'rescheduled')}
        onSkip={() => onStatusChange(item.id, 'skipped')}
      />
    )
  }

  // If no future items were found and today, still might need the "now" line at end
  if (isToday && !nowLineInserted) {
    const currentItem = items.find(it => {
      const start = it.scheduled_time?.slice(0, 5) ?? ''
      const end = it.scheduled_end_time?.slice(0, 5) ?? ''
      return start <= nowTime && end > nowTime
    })
    result.push(
      <div key="now-line" style={{
        fontSize: 12, color: '#C4725A', margin: '6px 0',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
        <span>{fmtTime(nowTime)}{currentItem ? ` ${currentItem.name}` : ''}</span>
        <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
      </div>
    )
  }

  return result
}

// ─── HopperRow ───────────────────────────────────────────────────────────────
// Minimal style matching TodoRow — plain row, single menu button, no cards

function HopperRow({ item, isVirtual, onCommit, onAutoPlace, onTimeShift, onDismiss, onLog, onDelete }: {
  item: HopperItem
  isVirtual: boolean
  onCommit: () => void
  onAutoPlace?: (overrides: { preferred_time: string; duration_minutes: number }, force: boolean) => void
  onTimeShift?: (date: string) => void
  onDismiss: () => void
  onLog?: () => void
  onDelete?: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [formTime, setFormTime] = useState('morning')
  const [formDur, setFormDur] = useState(30)

  return (
    <div style={{
      padding: '5px 0', userSelect: 'none',
      borderBottom: '1px solid #F8F7F4',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Empty checkbox-sized spacer to align with TodoRow */}
        <span style={{
          width: 14, height: 14, flexShrink: 0,
          border: '1.5px dashed #D0CBC3', borderRadius: 2,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }} onClick={e => { e.stopPropagation(); onCommit() }} title="Add to today" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, color: '#8A8578' }}>
            {item.name}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
            title="Actions"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#B5B0A8', fontSize: 16, padding: '0 4px',
              minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            ···
          </button>
          {showMenu && (
            <>
              <div onClick={e => { e.stopPropagation(); setShowMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 51,
                background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160, overflow: 'hidden',
              }}>
                <button onClick={e => { e.stopPropagation(); setShowMenu(false); onCommit() }} style={menuItemStyle}>
                  + Add to today
                </button>
                {onAutoPlace && (
                  <button onClick={e => { e.stopPropagation(); setShowMenu(false); setShowScheduleForm(true) }} style={menuItemStyle}>
                    ⏱ Schedule
                  </button>
                )}
                {onTimeShift && !isVirtual && (
                  <>
                    {LATER_OPTIONS.map(opt => (
                      <button key={opt.label} onClick={e => { e.stopPropagation(); setShowMenu(false); onTimeShift(opt.getDate()) }} style={menuItemStyle}>
                        → {opt.label}
                      </button>
                    ))}
                  </>
                )}
                {isVirtual && (
                  <button onClick={e => { e.stopPropagation(); setShowMenu(false); onDismiss() }} style={menuItemStyle}>
                    ✕ Skip this week
                  </button>
                )}
                {!isVirtual && onLog && (
                  <button onClick={e => { e.stopPropagation(); setShowMenu(false); onLog() }} style={menuItemStyle}>
                    ✓ Log as done
                  </button>
                )}
                {!isVirtual && onDelete && (
                  <button onClick={e => { e.stopPropagation(); setShowMenu(false); onDelete() }} style={{ ...menuItemStyle, color: '#C4725A', borderBottom: 'none' }}>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inline schedule form — expands below the row */}
      {showScheduleForm && onAutoPlace && (
        <div onClick={e => e.stopPropagation()} style={{ paddingLeft: 22, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {SCHEDULE_TIME_OPTIONS.map(t => (
              <button key={t} onClick={() => setFormTime(t)} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: formTime === t ? '#4B82AF' : '#F5F3EF',
                color: formTime === t ? '#FFF' : '#5A5650',
                border: `1px solid ${formTime === t ? '#4B82AF' : 'transparent'}`,
                fontWeight: formTime === t ? 600 : 400,
              }}>{SCHEDULE_TIME_LABELS[t]}</button>
            ))}
            <input type="text" placeholder="HH:MM"
              value={SCHEDULE_TIME_OPTIONS.includes(formTime as typeof SCHEDULE_TIME_OPTIONS[number]) ? '' : formTime}
              onChange={e => setFormTime(e.target.value)}
              style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 10, width: 52,
                border: `1px solid ${!SCHEDULE_TIME_OPTIONS.includes(formTime as typeof SCHEDULE_TIME_OPTIONS[number]) && formTime ? '#4B82AF' : '#E0DDD6'}`,
                background: !SCHEDULE_TIME_OPTIONS.includes(formTime as typeof SCHEDULE_TIME_OPTIONS[number]) && formTime ? '#4B82AF12' : '#F5F3EF',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {SCHEDULE_DUR_OPTIONS.map(d => (
              <button key={d} onClick={() => setFormDur(d)} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: formDur === d ? '#4B82AF' : '#F5F3EF',
                color: formDur === d ? '#FFF' : '#5A5650',
                border: `1px solid ${formDur === d ? '#4B82AF' : 'transparent'}`,
                fontWeight: formDur === d ? 600 : 400,
              }}>{d}m</button>
            ))}
            <button onClick={e => { e.stopPropagation(); onAutoPlace({ preferred_time: formTime, duration_minutes: formDur }, false); setShowScheduleForm(false) }} style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10,
              background: '#5A9E6F', color: '#FFF', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>Go →</button>
            <button onClick={() => setShowScheduleForm(false)} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 10,
              background: 'transparent', color: '#B5B0A8', border: '1px solid #E0DDD6', cursor: 'pointer', fontFamily: 'inherit',
            }}>cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
