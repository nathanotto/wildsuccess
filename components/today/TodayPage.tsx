'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ActionItemWithNotes, ItemNote } from '@/lib/types'
import CaptureInput from '@/components/capture/CaptureInput'

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

function Checkbox({ status, onClick }: { status: string; onClick: () => void }) {
  const base: React.CSSProperties = {
    width: 14, height: 14,
    border: '1.5px solid',
    borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden',
  }

  if (status === 'committed') {
    return (
      <span style={{ ...base, borderColor: '#B5B0A8', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick() }} />
    )
  }
  if (status === 'in_progress') {
    return (
      <span style={{ ...base, borderColor: '#C4725A', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick() }}>
        <span style={{ width: 6, height: 6, background: '#C4725A', borderRadius: 1 }} />
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span style={{ ...base, borderColor: '#8A857D', background: '#8A857D', color: 'white', fontSize: 10 }}
        onClick={e => { e.stopPropagation(); onClick() }}>
        ✓
      </span>
    )
  }
  if (status === 'parked') {
    return (
      <span style={{ ...base, borderColor: '#B5B0A8', background: 'transparent' }}
        onClick={e => { e.stopPropagation(); onClick() }}>
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
        onClick={e => { e.stopPropagation(); onClick() }}>
        ✕
      </span>
    )
  }
  // fallback
  return (
    <span style={{ ...base, borderColor: '#B5B0A8' }}
      onClick={e => { e.stopPropagation(); onClick() }} />
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
  nextUp: ActionItemWithNotes | null
  isToday: boolean
}

function FocusView({
  item, onBack, onStatusChange, onTitleChange, onAddNote, onCompleteStep, onAddFollowUp, onMoveToTomorrow, onMarkDoneAndCapture, onDelete, nextUp, isToday,
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
            {title}
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
            item.time_type === 'C' ? 'Unwanted' : item.time_type === 'D' ? 'Self-care' :
              item.time_type === '0' ? 'Free' : ''}
          {item.emotional_weight === 'heavy' ? ' · heavy' : ''}
          {item.bounding_type === 'time' ? ' · time-bounded' : ''}
        </div>
      )}

      {/* Steps section */}
      <div style={section}>
        <div style={{ fontSize: 11, color: '#8A8578', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Steps
        </div>
        {steps.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '6px 8px', marginBottom: 2,
          }}>
            <Checkbox status={s.is_completed ? 'completed' : 'committed'} onClick={() => !s.is_completed && handleCheckStep(s.id)} />
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
        <input
          value={stepInput}
          onChange={e => setStepInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep() } }}
          placeholder={steps.filter(s => !s.is_completed).length === 0 ? "what's next?" : "add step..."}
          style={{ ...inputStyle, marginTop: steps.length > 0 ? 4 : 0 }}
        />
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
        <input
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          onKeyDown={handleAddNote}
          placeholder="add note..."
          style={{ ...inputStyle, paddingLeft: 46 }}
        />
      </div>

      {/* Follow-ups for time-locked (meeting) items */}
      {isTimeLocked && (
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

      {/* Bottom actions */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => onStatusChange(item.id, 'completed').then(onBack)}
          style={actionBtnStyle}>
          → Mark done
        </button>
        <button
          onClick={() => onStatusChange(item.id, 'parked').then(onBack)}
          style={actionBtnStyle}>
          → Done for today
        </button>
        <button
          onClick={() => onMoveToTomorrow(item.id).then(onBack)}
          style={actionBtnStyle}>
          → Move to tomorrow
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
            → Mark done and capture follow-up
          </button>
        )}
        <button
          onClick={() => onStatusChange(item.id, 'rescheduled').then(onBack)}
          style={actionBtnStyle}>
          ↺ Send back to hopper
        </button>
        <button
          onClick={() => onStatusChange(item.id, 'skipped').then(onBack)}
          style={actionBtnStyle}>
          ✕ Skip and dismiss
        </button>
        <button
          onClick={() => { if (window.confirm('Delete this item permanently?')) onDelete(item.id).then(onBack) }}
          style={{ ...actionBtnStyle, color: '#C4725A' }}>
          ⌫ Delete like it never happened
        </button>
      </div>

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

  const isToday = selectedDate === todayStr
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
    todo: items.filter(i => i.status === 'committed').length,
    skipped: items.filter(i => i.status === 'skipped').length,
  }

  const focusItem = items.find(i => i.id === focusItemId) ?? null

  // Next up for today list view (upcoming time-locked, not yet past)
  const listNextUp = isToday ? items
    .filter(i => i.scheduled_time && i.status !== 'completed' && i.status !== 'skipped')
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    .find(i => (i.scheduled_time ?? '') > nowTime) ?? null : null

  // Filter logged items to only those whose created_at falls on the selected local date
  const filteredLoggedItems = loggedItems.filter(entry => {
    const localDate = toDateStr(new Date(entry.created_at))
    return localDate === selectedDate
  })

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async function handleDeleteLogEntry(id: string) {
    setLoggedItems(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/action-log/${id}`, { method: 'DELETE' })
  }

  async function handleStatusChange(id: string, status: string) {
    // Optimistic update — move item between sections instantly
    setItems(prev => {
      if (status === 'rescheduled') {
        return prev.filter(i => i.id !== id)
      }
      return prev.map(i => i.id === id ? { ...i, status: status as ActionItemWithNotes['status'] } : i)
    })

    const res = await fetch(`/api/action-items/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (data.item) {
      // Reconcile with server response
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...data.item } : i))
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

  async function handleAddFollowUp(content: string, sourceId: string) {
    await fetch('/api/today/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: content, parent_action_item_id: sourceId }),
    })
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: '0 16px',
    fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif',
    fontSize: 14, color: '#2D2A26', background: '#FAFAF7', minHeight: '100vh',
  }

  return (
    <div style={{ background: '#FAFAF7', minHeight: '100vh' }}>
      {/* Nav */}
      <div style={{
        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #F0EDE6', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => router.push('/map')} style={{
          fontSize: 14, fontWeight: 700, color: '#C4725A', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>Wild Success</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#8A8578' }}>{displayName}</span>
      </div>

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
            nextUp={nextUp}
            isToday={isToday}
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
                  {stats.done} done · {stats.inProgress} in progress · {stats.todo} to-do{stats.skipped > 0 ? ` · ${stats.skipped} skipped` : ''}
                </div>

                {/* To-do section */}
                {todoItems.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    {todoItems.map(item => (
                      <TodoRow
                        key={item.id}
                        item={item}
                        onCheckbox={() => handleCheckboxCycle(item)}
                        onFocus={() => setFocusItemId(item.id)}
                        onReschedule={() => handleStatusChange(item.id, 'rescheduled')}
                        onSkip={() => handleStatusChange(item.id, 'skipped')}
                      />
                    ))}
                  </div>
                )}

                {/* Schedule section */}
                {scheduleItems.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ height: 1, background: '#F0EDE6', marginBottom: 8 }} />
                    {renderScheduleItems(scheduleItems, nowTime, isToday, handleCheckboxCycle, setFocusItemId, handleStatusChange)}
                  </div>
                )}

                {todoItems.length === 0 && scheduleItems.length === 0 && (
                  <div style={{ fontSize: 12, color: '#B5B0A8', paddingTop: 20 }}>
                    Nothing scheduled for this day.
                  </div>
                )}

                {/* Capture */}
                <div style={{ borderTop: '1px solid #E8E4DC', marginTop: 8 }}>
                  <CaptureInput
                    source="today"
                    onItemCreated={item => setItems(prev => [...prev, item])}
                    onLogEntry={() => loadData(selectedDate)}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── TodoRow ─────────────────────────────────────────────────────────────────

function TodoRow({
  item, onCheckbox, onFocus, onReschedule, onSkip,
}: {
  item: ActionItemWithNotes
  onCheckbox: () => void
  onFocus: () => void
  onReschedule: () => void
  onSkip: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuOpenedAt = useRef(0)
  const isCompleted = item.status === 'completed'
  const isParked = item.status === 'parked'
  const isSkipped = item.status === 'skipped'
  const muted = isCompleted || isParked || isSkipped

  const steps = (item.item_notes ?? [])
    .filter(n => n.note_type === 'step')
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div
      onClick={onFocus}
      style={{
        padding: '5px 0', cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid #F8F7F4',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Checkbox status={item.status} onClick={onCheckbox} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 14,
            color: muted ? '#B5B0A8' : '#2D2A26',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}>
            {item.name}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
            title="Skip or send back"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A857D', fontSize: 16, padding: '0 4px',
              minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            ↺
          </button>
          {showMenu && (
            <>
              <div onClick={e => { e.stopPropagation(); setShowMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 51,
                background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160, overflow: 'hidden',
              }}>
                <button onClick={e => { e.stopPropagation(); setShowMenu(false); onSkip() }} style={menuItemStyle}>
                  ✕ Didn&apos;t happen
                </button>
                <button onClick={e => { e.stopPropagation(); setShowMenu(false); onReschedule() }} style={menuItemStyle}>
                  ↺ Send to hopper
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {steps.length > 0 && (
        <div style={{ paddingLeft: 22, marginTop: 3 }}>
          {steps.map(s => (
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
    </div>
  )
}

// ─── ScheduleRow ──────────────────────────────────────────────────────────────

function ScheduleRow({ item, onCheckbox, onFocus, onReschedule, onSkip }: {
  item: ActionItemWithNotes
  onCheckbox: () => void
  onFocus: () => void
  onReschedule: () => void
  onSkip: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const isCompleted = item.status === 'completed'
  const isParked = item.status === 'parked'
  const isSkipped = item.status === 'skipped'
  const muted = isCompleted || isParked || isSkipped

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
      <Checkbox status={item.status} onClick={onCheckbox} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 14,
          color: muted ? '#B5B0A8' : '#2D2A26',
          textDecoration: isCompleted ? 'line-through' : 'none',
        }}>
          {item.name}
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
          title="Skip or send back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8A857D', fontSize: 16, padding: '0 4px',
            minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ↺
        </button>
        {showMenu && (
          <>
            <div onClick={e => { e.stopPropagation(); setShowMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 51,
              background: '#FFFFFF', border: '1px solid #E8E4DC', borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 160, overflow: 'hidden',
            }}>
              <button onClick={e => { e.stopPropagation(); setShowMenu(false); onSkip() }} style={menuItemStyle}>
                ✕ Didn&apos;t happen
              </button>
              <button onClick={e => { e.stopPropagation(); setShowMenu(false); onReschedule() }} style={menuItemStyle}>
                ↺ Send to hopper
              </button>
            </div>
          </>
        )}
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
) {
  const result: React.ReactNode[] = []
  let nowLineInserted = false

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemTime = item.scheduled_time?.slice(0, 5) ?? ''

    // Insert "now" line between past and future items (today only)
    if (isToday && !nowLineInserted && itemTime > nowTime) {
      nowLineInserted = true
      result.push(
        <div key="now-line" style={{
          fontSize: 12, color: '#C4725A', margin: '6px 0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
          <span>now {fmtTime(nowTime)}</span>
          <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
        </div>
      )
    }

    result.push(
      <ScheduleRow
        key={item.id}
        item={item}
        onCheckbox={() => onCheckbox(item)}
        onFocus={() => onFocus(item.id)}
        onReschedule={() => onStatusChange(item.id, 'rescheduled')}
        onSkip={() => onStatusChange(item.id, 'skipped')}
      />
    )
  }

  // If no future items were found and today, still might need the "now" line at end
  if (isToday && !nowLineInserted) {
    result.push(
      <div key="now-line" style={{
        fontSize: 12, color: '#C4725A', margin: '6px 0',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
        <span>now {fmtTime(nowTime)}</span>
        <span style={{ height: 1, background: '#C4725A', flex: 1 }} />
      </div>
    )
  }

  return result
}
