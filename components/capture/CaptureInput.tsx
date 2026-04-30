'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ActionItemWithNotes } from '@/lib/types'
import type { ParsedCapture } from '@/lib/capture-parser'
import { COLORS } from '@/lib/theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return 'Today'
  if (dDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? 'a' : 'p'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  source: 'today' | 'organize' | 'map'
  placeholder?: string
  selectedDate?: string
  onItemCreated?: (item: ActionItemWithNotes) => void
  onLogEntry?: () => void
  inputStyle?: React.CSSProperties
  wrapperStyle?: React.CSSProperties
}

export default function CaptureInput({
  source, placeholder = 'capture...', selectedDate, onItemCreated, onLogEntry, inputStyle, wrapperStyle,
}: Props) {
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Picker state: after parsing, show placement options
  const [parsed, setParsed] = useState<ParsedCapture | null>(null)
  const [rawText, setRawText] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerTime, setPickerTime] = useState('')
  const [placing, setPlacing] = useState(false)

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submittingRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  function showToast(msg: string) {
    clearTimers()
    setToastMsg(msg)
    setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
  }

  function dismissPicker() {
    setParsed(null)
    setRawText('')
  }

  // Step 1: Parse the input (no DB writes)
  async function handleSubmit() {
    if (!input.trim() || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const text = input.trim()
    setInput('')
    try {
      const res = await fetch('/api/capture/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: text }),
      })
      if (!res.ok) return
      const { parsed: p } = await res.json()
      setRawText(text)
      setParsed(p)
      // Pre-fill date/time from parser
      setPickerDate(p.date ?? selectedDate ?? todayStr())
      setPickerTime(p.time ?? '')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Step 2: Place the item based on user's choice
  async function handlePlace(placement: 'todo_today' | 'todo_date' | 'book_time' | 'log') {
    if (!parsed || placing) return
    setPlacing(true)
    try {
      const body: Record<string, unknown> = {
        placement,
        rawInput: rawText,
        cleanedName: parsed.cleanedName,
        timeType: parsed.timeType,
        personId: parsed.person?.id ?? null,
        activityId: parsed.activityMatch?.id ?? null,
        valueIds: parsed.valueLinks.map(vl => vl.valueId),
        duration: parsed.duration,
      }
      if (placement === 'todo_date') {
        body.date = pickerDate
      } else if (placement === 'book_time') {
        body.date = pickerDate
        body.time = pickerTime
        body.endTime = parsed.endTime
      }

      const res = await fetch('/api/capture/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      const data = await res.json()

      if (data.actionItem && onItemCreated) onItemCreated(data.actionItem)
      if (data.logEntry && onLogEntry) onLogEntry()

      // Confirmation toast
      const confirmMsg =
        placement === 'log' ? `Logged: ${parsed.cleanedName}` :
        placement === 'todo_today' ? `To-do: ${parsed.cleanedName}` :
        placement === 'todo_date' ? `To-do for ${formatDateLabel(pickerDate)}: ${parsed.cleanedName}` :
        `Booked ${formatDateLabel(pickerDate)} ${formatTime(pickerTime)}: ${parsed.cleanedName}`
      showToast(confirmMsg)
      dismissPicker()
    } finally {
      setPlacing(false)
    }
  }

  // Suggested placement based on parser outcome
  function suggestedPlacement(): 'todo_today' | 'todo_date' | 'book_time' | 'log' {
    if (!parsed) return 'todo_today'
    if (parsed.outcome === 'logged') return 'log'
    if (parsed.time) return 'book_time'
    if (parsed.date && parsed.date !== todayStr()) return 'todo_date'
    return 'todo_today'
  }

  const suggested = parsed ? suggestedPlacement() : null
  const hasDate = parsed?.date && parsed.date !== todayStr()
  const hasTime = !!parsed?.time

  const btnBase: React.CSSProperties = {
    padding: '5px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600,
    cursor: placing ? 'default' : 'pointer', border: '1px solid #E8E4DC',
    background: '#F8F7F4', color: '#2D2A26', fontFamily: 'inherit',
    opacity: placing ? 0.5 : 1,
  }
  const btnHighlight: React.CSSProperties = {
    ...btnBase,
    background: COLORS.primary, color: '#FFF', border: `1px solid ${COLORS.primary}`,
  }

  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } if (e.key === 'Escape') dismissPicker() }}
        placeholder={submitting ? 'Parsing…' : placeholder}
        disabled={submitting}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          outline: 'none', fontSize: 14, color: '#2D2A26',
          padding: '12px 0', fontFamily: 'inherit', boxSizing: 'border-box',
          ...inputStyle,
        }}
      />

      {/* Placement picker */}
      {parsed && (
        <div style={{
          background: '#FFF', border: '1px solid #5A9E6F', borderRadius: 6,
          boxShadow: '0 0 8px rgba(90,158,111,0.4)',
          padding: '10px 12px', marginTop: 4, marginBottom: 4,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2A26', marginBottom: 6 }}>
            {parsed.cleanedName}
          </div>
          {(hasDate || hasTime || parsed.person) && (
            <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 6 }}>
              {[
                hasDate ? formatDateLabel(parsed.date!) : null,
                hasTime ? formatTime(parsed.time!) : null,
                parsed.person ? parsed.person.name : null,
              ].filter(Boolean).join(' · ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => handlePlace('todo_today')}
              style={suggested === 'todo_today' ? btnHighlight : btnBase}
            >To-do</button>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => handlePlace('todo_date')}
                style={suggested === 'todo_date' ? btnHighlight : btnBase}
              >To-do for</button>
              <input
                type="date"
                value={pickerDate}
                onChange={e => setPickerDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 11, border: '1px solid #E8E4DC', borderRadius: 4, padding: '3px 4px', color: '#2D2A26', fontFamily: 'inherit' }}
              />
            </span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => handlePlace('book_time')}
                style={suggested === 'book_time' ? btnHighlight : btnBase}
                disabled={!pickerTime}
              >Book time</button>
              <input
                type="time"
                value={pickerTime}
                onChange={e => setPickerTime(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 11, border: '1px solid #E8E4DC', borderRadius: 4, padding: '3px 4px', color: '#2D2A26', fontFamily: 'inherit' }}
              />
            </span>

            <button
              onClick={() => handlePlace('log')}
              style={suggested === 'log' ? btnHighlight : btnBase}
            >Log it</button>

            <button
              onClick={dismissPicker}
              style={{ ...btnBase, color: '#B5B0A8', border: 'none', background: 'none', fontSize: 11 }}
            >cancel</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastVisible && toastMsg && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#2E7D32',
          padding: '6px 12px', lineHeight: 1.4, marginTop: 4, marginBottom: 4,
          background: '#FFF', border: '1px solid #5A9E6F', borderRadius: 6,
          boxShadow: '0 0 8px rgba(90,158,111,0.4)',
          animation: 'fadeOut 0.5s ease 3s forwards',
        }}>
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; pointer-events: none; }
        }
      `}</style>
    </div>
  )
}
