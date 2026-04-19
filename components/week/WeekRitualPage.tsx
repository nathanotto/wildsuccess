'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CaptureInput from '@/components/capture/CaptureInput'

const FONT = '"Source Sans 3", "Source Sans Pro", sans-serif'

interface WeekRecord {
  id: string
  week_start: string
  create_statement: string | null
  complete_statement: string | null
  created_at_ritual: string | null
  completed_at_ritual: string | null
  organized_at: string | null
  deconflicted_at: string | null
}

interface CaptureEntry {
  timestamp: string
  type: 'action_item' | 'note' | 'day_log' | 'reflection' | 'capture'
  text: string
  source_id: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function friendlyRange(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${fmt(start)} → ${fmt(end)}`
}

function fmtCapTimestamp(ts: string): string {
  const d = new Date(ts)
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'p' : 'a'
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${day} ${hr}:${String(m).padStart(2, '0')}${ampm}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeekRitualPage() {
  const params = useParams()
  const router = useRouter()
  const weekStart = params.week_start as string
  const nextWeekStart = addWeeks(weekStart, 1)

  // Determine default tab: past weeks → Complete, current/future → Create
  const today = todayStr()
  const weekEnd = addWeeks(weekStart, 1)
  const isPast = today >= weekEnd // week has ended
  const defaultTab = isPast ? 'complete' : 'create'

  const [tab, setTab] = useState<'complete' | 'create'>(defaultTab)
  const [weekRecord, setWeekRecord] = useState<WeekRecord | null>(null)
  const [captures, setCaptures] = useState<CaptureEntry[]>([])
  const [landscape, setLandscape] = useState<CaptureEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [completeText, setCompleteText] = useState('')
  const [createText, setCreateText] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const NC = { cache: 'no-store' } as const
    const [weekRes, capsRes, landscapeRes] = await Promise.all([
      fetch(`/api/weeks/${weekStart}`, NC),
      fetch(`/api/weeks/${weekStart}/captures`, NC),
      // For Create tab: show what's on the books for this week (same captures endpoint)
      fetch(`/api/weeks/${weekStart}/captures`, NC),
    ])
    const weekData = await weekRes.json()
    const capsData = await capsRes.json()
    const landscapeData = await landscapeRes.json()

    setWeekRecord(weekData?.id ? weekData : null)
    setCaptures(Array.isArray(capsData) ? capsData : [])
    setLandscape(Array.isArray(landscapeData) ? landscapeData : [])
    setCompleteText(weekData?.complete_statement ?? '')
    setCreateText(weekData?.create_statement ?? '')
    setLoading(false)
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  // Reset tab when navigating to a different week
  useEffect(() => {
    const end = addWeeks(weekStart, 1)
    setTab(today >= end ? 'complete' : 'create')
  }, [weekStart, today])

  // ── Auto-save ───────────────────────────────────────────────────────────────

  function autoSave(field: 'complete_statement' | 'create_statement', value: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/weeks/${weekStart}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      setSaved(field)
      setTimeout(() => setSaved(null), 2000)
    }, 1000)
  }

  // ── Checkbox toggle ─────────────────────────────────────────────────────────

  async function toggleCheckbox(field: 'completed_at_ritual' | 'created_at_ritual' | 'organized_at' | 'deconflicted_at') {
    const currentValue = weekRecord ? (weekRecord as unknown as Record<string, unknown>)[field] : null
    const newValue = currentValue ? null : new Date().toISOString()
    await fetch(`/api/weeks/${weekStart}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newValue }),
    })
    const res = await fetch(`/api/weeks/${weekStart}`, { cache: 'no-store' })
    const data = await res.json()
    setWeekRecord(data)
  }

  const isChecked = (field: string) => !!(weekRecord as unknown as Record<string, unknown> | null)?.[field]

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: 14, height: 14, border: `1.5px solid ${checked ? '#5A9E6F' : '#C4BFB4'}`,
    borderRadius: 2, background: checked ? '#5A9E6F' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, fontSize: 9, color: '#FFF', marginRight: 4,
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 15, fontWeight: active ? 700 : 400,
    color: active ? '#2D2A26' : '#B5B0A8',
    cursor: 'pointer', padding: '4px 0',
    borderBottom: active ? '2px solid #2D2A26' : '2px solid transparent',
    background: 'none', border: 'none', borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: active ? '#2D2A26' : 'transparent',
    fontFamily: FONT,
  })

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button onClick={() => router.push(`/week/${addWeeks(weekStart, -1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#8A8578' }}>{friendlyRange(weekStart)}</div>
            </div>
            <button onClick={() => router.push(`/week/${addWeeks(weekStart, 1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>→</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <button onClick={() => setTab('complete')} style={tabStyle(tab === 'complete')}>Complete</button>
            <button onClick={() => setTab('create')} style={tabStyle(tab === 'create')}>Create</button>
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {([
              { field: 'completed_at_ritual' as const, label: 'Completed' },
              { field: 'created_at_ritual' as const, label: 'Created' },
              { field: 'organized_at' as const, label: 'Organized' },
              { field: 'deconflicted_at' as const, label: 'De-conflicted' },
            ]).map(({ field, label }) => (
              <span key={field} onClick={() => toggleCheckbox(field)} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, color: isChecked(field) ? '#2D2A26' : '#B5B0A8' }}>
                <span style={checkboxStyle(isChecked(field))}>{isChecked(field) ? '✓' : ''}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Complete Tab ──────────────────────────────────────────────────── */}
        {tab === 'complete' && (
          <>
            {/* This week's intent (what you wrote when creating) */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>My intent for this week</div>
              <div style={{ fontSize: 15, lineHeight: 1.7, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
                {weekRecord?.create_statement ?? 'No intent was set for this week.'}
              </div>
            </div>

            {/* Captures stream — the week in your own words */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>This week, in your words</div>
              {captures.length === 0 ? (
                <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>No captures this week.</div>
              ) : (
                <div>
                  {captures.map((c, i) => (
                    <CaptureEntryRow key={c.source_id + i} timestamp={c.timestamp} text={c.text} />
                  ))}
                </div>
              )}
            </div>

            {/* Capture — late additions */}
            <div style={{ marginBottom: 32 }}>
              <CaptureInput source="today" placeholder="Add something to this week's record..." onLogEntry={() => loadData()} />
            </div>

            {/* Reflection */}
            <div style={{ marginBottom: 32, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reflect on this week</div>
                <span
                  onClick={() => setShowHelp(showHelp === 'complete' ? null : 'complete')}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}
                >?</span>
                {saved === 'complete_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
              </div>
              {showHelp === 'complete' && (
                <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                  Looking back at the week through your own words helps you notice patterns, surprises, and the gap between intent and reality.
                </div>
              )}
              <div style={{ fontSize: 13, color: '#B5B0A8', marginBottom: 8, lineHeight: 1.5 }}>
                Was that what you expected? What did you feel and notice? What surprised you?
              </div>
              <textarea
                value={completeText}
                onChange={e => { setCompleteText(e.target.value); autoSave('complete_statement', e.target.value) }}
                onBlur={() => autoSave('complete_statement', completeText)}
                rows={4}
                style={{ width: '100%', fontSize: 15, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '12px 14px', background: '#FFFFFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>

            {/* Flow link */}
            <div style={{ paddingTop: 8 }}>
              <span
                onClick={() => { router.push(`/week/${nextWeekStart}`); }}
                style={{ fontSize: 13, color: '#C4725A', cursor: 'pointer' }}
              >
                Create next week →
              </span>
            </div>
          </>
        )}

        {/* ── Create Tab ───────────────────────────────────────────────────── */}
        {tab === 'create' && (
          <>
            {/* Landscape — what's on the books */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>What&apos;s on the books</div>
              {landscape.length === 0 ? (
                <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing scheduled yet.</div>
              ) : (
                <div>
                  {landscape.map((c, i) => (
                    <CaptureEntryRow key={c.source_id + i} timestamp={c.timestamp} text={c.text} />
                  ))}
                </div>
              )}
            </div>

            {/* Capture — add things to the week */}
            <div style={{ marginBottom: 32 }}>
              <CaptureInput source="organize" placeholder="Add something to this week..." onItemCreated={() => loadData()} onLogEntry={() => loadData()} />
            </div>

            {/* Intent */}
            <div style={{ marginBottom: 32, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Set your intent</div>
                <span
                  onClick={() => setShowHelp(showHelp === 'create' ? null : 'create')}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}
                >?</span>
                {saved === 'create_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
              </div>
              {showHelp === 'create' && (
                <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                  Setting intent for the week — not as a plan, but as a statement of expectation — gives next week&apos;s reflection something to compare against.
                </div>
              )}
              <div style={{ fontSize: 13, color: '#B5B0A8', marginBottom: 8, lineHeight: 1.5 }}>
                What do you expect and intend for this coming week? What might be hard? What might be wonderful?
              </div>
              <textarea
                value={createText}
                onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value) }}
                onBlur={() => autoSave('create_statement', createText)}
                rows={4}
                style={{ width: '100%', fontSize: 15, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '12px 14px', background: '#FFFFFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>

            {/* Flow links */}
            <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
              <a href="/organize" style={{ fontSize: 13, color: '#8A8578', textDecoration: 'none' }}>Organize this week →</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── CaptureEntryRow — truncatable capture entry ─────────────────────────────

const LINE_HEIGHT = 1.6
const MAX_LINES = 5
const MAX_HEIGHT = `calc(${MAX_LINES} * ${LINE_HEIGHT}em)`

function CaptureEntryRow({ timestamp, text }: { timestamp: string; text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [needsTruncation, setNeedsTruncation] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    setNeedsTruncation(el.scrollHeight > el.clientHeight + 2)
  }, [text])

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: '#C4BFB4', width: 60, flexShrink: 0, paddingTop: 3, textAlign: 'right' }}>
        {fmtCapTimestamp(timestamp)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          ref={textRef}
          style={{
            fontSize: 15, lineHeight: LINE_HEIGHT, color: '#2D2A26', display: 'block',
            maxHeight: expanded ? 'none' : MAX_HEIGHT, overflow: 'hidden',
          }}
        >{text}</span>
        {(needsTruncation || expanded) && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8A857D', padding: '2px 0', fontFamily: FONT }}
          >{expanded ? '▲ less' : '▼ more'}</button>
        )}
      </div>
    </div>
  )
}
