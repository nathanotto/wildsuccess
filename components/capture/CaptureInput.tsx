'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ActionItemWithNotes } from '@/lib/types'
import type { ParsedCapture } from '@/lib/capture-parser'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date(now); today.setHours(0, 0, 0, 0)
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

function fmtTimeShort(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === '00' ? `${hour}${ampm}` : `${hour}:${m}${ampm}`
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function toastMessage(parsed: ParsedCapture): string {
  const { outcome, cleanedName, date, time, person } = parsed
  const dateLabel = date ? formatDateLabel(date) : null
  switch (outcome) {
    case 'logged': return `Logged: ${cleanedName}`
    case 'captured': return `Captured: ${cleanedName}`
    case 'captured_dated': return `${dateLabel}: ${cleanedName}`
    case 'scheduled_soft':
      return `Penciled in: ${cleanedName}${dateLabel ? `, ${dateLabel}` : ''}${time ? ` ${formatTime(time)}` : ''}`
    case 'scheduled_hard':
      return `Booked: ${cleanedName}${dateLabel ? `, ${dateLabel}` : ''}${time ? ` ${formatTime(time)}` : ''}`
    case 'tickler': return `Reminder set: ${dateLabel ?? 'future date'}`
    case 'outside_request': return `From ${person?.name ?? 'someone'}: ${cleanedName}`
    case 'commitment': return `Committed to ${person?.name ?? 'someone'}: ${cleanedName}`
    default: return `Captured: ${cleanedName}`
  }
}

function cardSummaryLine(parsed: ParsedCapture): string {
  const parts: string[] = []
  if (parsed.date) parts.push(formatDateLabel(parsed.date))
  if (parsed.time) parts.push(formatTime(parsed.time))
  if (parsed.person) parts.push(parsed.person.name)
  if (parsed.duration) parts.push(`${parsed.duration < 60 ? parsed.duration + ' min' : parsed.duration / 60 + ' hr'}`)
  return parts.join(' · ')
}

function outcomeLabel(parsed: ParsedCapture): string {
  switch (parsed.outcome) {
    case 'logged': return '← logged'
    case 'captured': return '→ to-do'
    case 'captured_dated': return `→ to-do for ${parsed.date ? formatDateLabel(parsed.date) : ''}`
    case 'scheduled_soft': return '→ scheduled'
    case 'scheduled_hard': return '→ booked'
    case 'tickler': return '→ reminder'
    case 'outside_request': return `→ request from ${parsed.person?.name ?? 'someone'}`
    case 'commitment': return `→ committed to ${parsed.person?.name ?? 'someone'}`
    default: return '→ captured'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  source: 'today' | 'organize' | 'map'
  placeholder?: string
  selectedDate?: string // The date context (e.g. tomorrow on /today tomorrow view)
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

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Card state
  const [card, setCard] = useState<ParsedCapture | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const [addingPerson, setAddingPerson] = useState(false)
  const [personAdded, setPersonAdded] = useState(false)
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Schedule confirmation state
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    itemId: string; name: string; date: string; time: string; endTime?: string | null
  } | null>(null)

  const submittingRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (cardTimer.current) clearTimeout(cardTimer.current)
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  function showToast(msg: string, parsed: ParsedCapture) {
    clearTimers()
    setToastMsg(msg)
    setToastVisible(true)
    setCard(null)
    setCardVisible(false)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
    // Store parsed for if user taps toast
    toastParsedRef.current = parsed
  }

  function showCard(parsed: ParsedCapture) {
    clearTimers()
    setCard(parsed)
    setCardVisible(true)
    setToastVisible(false)
    setPersonAdded(false)
    cardTimer.current = setTimeout(() => setCardVisible(false), 5000)
  }

  function dismissCard() {
    clearTimers()
    setCardVisible(false)
    setCard(null)
  }

  const toastParsedRef = useRef<ParsedCapture | null>(null)

  async function handleSubmit() {
    if (!input.trim() || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const text = input.trim()
    setInput('')
    try {
      // Detect likely scheduled input — strip quoted sections first so literal dates don't trigger
      const textNoQuotes = text.replace(/["'][^"']*["']/g, '')
      const isScheduled = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(textNoQuotes) || /\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(textNoQuotes)
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: text, source, selectedDate, deferScheduling: isScheduled }),
      })
      if (!res.ok) return
      const data = await res.json()
      const parsed: ParsedCapture = data.parsed

      // For scheduled items: show confirmation instead of auto-scheduling
      if (isScheduled && (parsed.outcome === 'scheduled_soft' || parsed.outcome === 'scheduled_hard') && parsed.time && data.actionItem) {
        setScheduleConfirm({
          itemId: data.actionItem.id,
          name: parsed.cleanedName,
          date: parsed.date ?? selectedDate ?? new Date().toISOString().split('T')[0],
          time: parsed.time,
          endTime: parsed.endTime,
        })
        // Don't add to parent yet — user hasn't confirmed
        return
      }

      // Add item to parent state
      if (data.actionItem && onItemCreated) onItemCreated(data.actionItem)
      if (data.logEntry && onLogEntry) onLogEntry()

      // UI feedback — logged items always get a toast (user narrated something, needs acknowledgment)
      if (parsed.outcome === 'logged' || parsed.confidence >= 0.6) {
        showToast(toastMessage(parsed), parsed)
      } else if (parsed.confidence >= 0.3) {
        showCard(parsed)
      }
      // Below 0.3 (non-logged): silent save
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function handleConfirmSchedule() {
    if (!scheduleConfirm) return
    const { itemId, date, time, endTime } = scheduleConfirm

    // Create time_block
    const blockRes = await fetch('/api/time-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        block_date: date,
        label: scheduleConfirm.name,
        start_time: time,
        end_time: endTime,
        source: 'manual',
      }),
    })
    const block = blockRes.ok ? await blockRes.json() : null

    // Commit the action item with schedule
    const patchRes = await fetch(`/api/action-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'committed',
        committed_date: date,
        scheduled_time: time,
        scheduled_end_time: endTime,
        time_block_id: block?.id ?? null,
      }),
    })
    if (patchRes.ok) {
      const item = await patchRes.json()
      if (onItemCreated) onItemCreated(item)
    }
    setScheduleConfirm(null)
  }

  function handleDismissSchedule() {
    if (!scheduleConfirm) return
    // Item already exists as candidate — just notify parent and dismiss
    // Fetch the item to pass to onItemCreated
    fetch(`/api/action-items/${scheduleConfirm.itemId}`).then(r => r.json()).then(items => {
      const item = Array.isArray(items) ? items[0] : items
      if (item && onItemCreated) onItemCreated(item)
    })
    setScheduleConfirm(null)
  }

  async function handleAddPerson() {
    if (!card?.unrecognizedName || addingPerson) return
    setAddingPerson(true)
    await fetch('/api/known-people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: card.unrecognizedName }),
    })
    setPersonAdded(true)
    setAddingPerson(false)
  }

  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
        placeholder={submitting ? 'Saving…' : placeholder}
        disabled={submitting}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          outline: 'none', fontSize: 14, color: '#2D2A26',
          padding: '12px 0', fontFamily: 'inherit', boxSizing: 'border-box',
          ...inputStyle,
        }}
      />

      {/* Toast */}
      {toastVisible && toastMsg && (
        <div
          onClick={() => {
            clearTimers()
            setToastVisible(false)
            if (toastParsedRef.current) showCard(toastParsedRef.current)
          }}
          style={{
            fontSize: 13, color: '#8A8578', cursor: 'pointer',
            paddingBottom: 6, lineHeight: 1.4,
            animation: 'fadeOut 0.5s ease 3s forwards',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Confirmation card */}
      {cardVisible && card && (
        <div style={{
          background: '#FFF',
          border: '1px solid #E8E4DC',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: '10px 12px',
          marginBottom: 4,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2A26', marginBottom: 4 }}>
            {card.cleanedName}
          </div>
          {cardSummaryLine(card) && (
            <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 2 }}>
              {cardSummaryLine(card)}
            </div>
          )}
          {card.valueLinks.length > 0 && (
            <div style={{ fontSize: 11, color: '#B5B0A8', marginBottom: 2 }}>
              {card.valueLinks.map(v => v.valueName).join(' · ')}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 8 }}>
            {outcomeLabel(card)}
          </div>
          {card.unrecognizedName && !personAdded && (
            <div style={{ fontSize: 12, color: '#4B6A82', marginBottom: 8 }}>
              Who is {card.unrecognizedName}?{' '}
              <span
                onClick={handleAddPerson}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                {addingPerson ? 'Adding…' : 'Add to contacts'}
              </span>
            </div>
          )}
          {personAdded && (
            <div style={{ fontSize: 12, color: '#4B6A82', marginBottom: 8 }}>
              {card.unrecognizedName} added
            </div>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <span
              onClick={dismissCard}
              style={{ fontSize: 12, color: '#8A8578', cursor: 'pointer' }}
            >
              Got it
            </span>
          </div>
        </div>
      )}

      {/* Schedule confirmation card */}
      {scheduleConfirm && (
        <div style={{
          background: '#FFF',
          border: '1px solid #E8E4DC',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: '10px 12px',
          marginBottom: 4,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2A26', marginBottom: 4 }}>
            {scheduleConfirm.name}
          </div>
          <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 8 }}>
            Schedule at {fmtTimeShort(scheduleConfirm.time)} on {fmtDateShort(scheduleConfirm.date)}?
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span
              onClick={handleConfirmSchedule}
              style={{ fontSize: 12, color: '#5A9E6F', cursor: 'pointer', fontWeight: 600 }}
            >
              Schedule
            </span>
            <span
              onClick={handleDismissSchedule}
              style={{ fontSize: 12, color: '#8A8578', cursor: 'pointer' }}
            >
              Just capture
            </span>
          </div>
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
