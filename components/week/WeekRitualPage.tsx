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
  type: 'action_item' | 'note' | 'day_log' | 'reflection' | 'capture' | 'completed'
  text: string
  source_id: string
  action_item_id?: string | null
  tag?: 'scheduled' | 'in_progress' | 'skipped' | 'sub_item' | null
  parent_name?: string | null
}

interface LandscapeItem {
  id: string
  name: string
  committed_date: string
  scheduled_time: string | null
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
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

function fmtDayTime(date: string, time: string | null): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  if (!time) return day
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'p' : 'a'
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${day} ${hr}:${m}${ampm}`
}

function getDayKey(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeekRitualPage() {
  const params = useParams()
  const router = useRouter()
  const weekStart = params.week_start as string
  const nextWeekStart = addWeeks(weekStart, 1)

  const [tab, setTab] = useState<'complete' | 'create'>('complete')

  const [weekRecord, setWeekRecord] = useState<WeekRecord | null>(null)
  const [captures, setCaptures] = useState<CaptureEntry[]>([])
  const [nextWeekRecord, setNextWeekRecord] = useState<WeekRecord | null>(null)
  const [landscape, setLandscape] = useState<LandscapeItem[]>([])

  const [loading, setLoading] = useState(true)
  const [completeText, setCompleteText] = useState('')
  const [createText, setCreateText] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWeekCompleted = !!weekRecord?.completed_at_ritual
  const isWeekCreated = !!nextWeekRecord?.created_at_ritual

  const loadData = useCallback(async () => {
    setLoading(true)
    const NC = { cache: 'no-store' } as const
    const nextWeekEnd = addDaysStr(nextWeekStart, 6)
    const [weekRes, capsRes, nextWeekRes, landscapeRes] = await Promise.all([
      fetch(`/api/weeks/${weekStart}`, NC),
      fetch(`/api/weeks/${weekStart}/captures`, NC),
      fetch(`/api/weeks/${nextWeekStart}`, NC),
      fetch(`/api/action-items?range_start=${nextWeekStart}&range_end=${nextWeekEnd}`, NC),
    ])
    const weekData = await weekRes.json()
    const capsData = await capsRes.json()
    const nextWeekData = await nextWeekRes.json()
    const landscapeData = await landscapeRes.json()

    setWeekRecord(weekData?.id ? weekData : null)
    setCaptures(Array.isArray(capsData) ? capsData : [])
    setNextWeekRecord(nextWeekData?.id ? nextWeekData : null)
    setLandscape(Array.isArray(landscapeData) ? landscapeData : [])
    setCompleteText(weekData?.complete_statement ?? '')
    setCreateText(nextWeekData?.create_statement ?? '')
    setLoading(false)
  }, [weekStart, nextWeekStart])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setTab('complete') }, [weekStart])

  // ── Auto-save ───────────────────────────────────────────────────────────────

  function autoSave(field: 'complete_statement' | 'create_statement', value: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const targetWeek = field === 'complete_statement' ? weekStart : nextWeekStart
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/weeks/${targetWeek}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      setSaved(field)
      setTimeout(() => setSaved(null), 2000)
    }, 1000)
  }

  // ── Complete / Create week actions ──────────────────────────────────────────

  async function handleCompleteWeek() {
    // Save reflection immediately
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await fetch(`/api/weeks/${weekStart}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complete_statement: completeText || null, completed_at_ritual: new Date().toISOString() }),
    })
    const res = await fetch(`/api/weeks/${weekStart}`, { cache: 'no-store' })
    setWeekRecord(await res.json())
  }

  async function handleReopenWeek() {
    await fetch(`/api/weeks/${weekStart}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at_ritual: null }),
    })
    const res = await fetch(`/api/weeks/${weekStart}`, { cache: 'no-store' })
    setWeekRecord(await res.json())
  }

  async function handleCreateWeek() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await fetch(`/api/weeks/${nextWeekStart}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ create_statement: createText || null, created_at_ritual: new Date().toISOString() }),
    })
    const res = await fetch(`/api/weeks/${nextWeekStart}`, { cache: 'no-store' })
    setNextWeekRecord(await res.json())
  }

  async function handleReopenCreate() {
    await fetch(`/api/weeks/${nextWeekStart}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_at_ritual: null }),
    })
    const res = await fetch(`/api/weeks/${nextWeekStart}`, { cache: 'no-store' })
    setNextWeekRecord(await res.json())
  }

  // ── Delete capture entry ─────────────────────────────────────────────────────

  async function handleDeleteEntry(entry: CaptureEntry) {
    setCaptures(prev => prev.filter(c => c.source_id !== entry.source_id))
    if (entry.type === 'note') {
      await fetch(`/api/item-notes/${entry.source_id}`, { method: 'DELETE' })
    } else {
      if (entry.action_item_id) {
        await fetch(`/api/action-items/${entry.action_item_id}`, { method: 'DELETE' })
      }
      await fetch(`/api/action-log/${entry.source_id}`, { method: 'DELETE' })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 15, fontWeight: active ? 700 : 400,
    color: active ? '#2D2A26' : '#B5B0A8',
    cursor: 'pointer', padding: '4px 0',
    background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? '#2D2A26' : 'transparent'}`,
    fontFamily: FONT,
  })

  const sortedLandscape = [...landscape].sort((a, b) => {
    const aKey = `${a.committed_date}${a.scheduled_time ?? '99:99'}`
    const bKey = `${b.committed_date}${b.scheduled_time ?? '99:99'}`
    return aKey.localeCompare(bKey)
  })

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.push(`/week/${addWeeks(weekStart, -1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#8A8578' }}>
              {tab === 'complete' ? friendlyRange(weekStart) : friendlyRange(nextWeekStart)}
            </div>
          </div>
          <button onClick={() => router.push(`/week/${addWeeks(weekStart, 1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setTab('complete')} style={tabStyle(tab === 'complete')}>
            Complete {isWeekCompleted && <span style={{ color: '#5A9E6F', marginLeft: 4 }}>✓</span>}
          </button>
          <button onClick={() => setTab('create')} style={tabStyle(tab === 'create')}>
            Create {isWeekCreated && <span style={{ color: '#5A9E6F', marginLeft: 4 }}>✓</span>}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px', display: 'flex', gap: 40 }}>

        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {tab === 'complete' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                This week, in your words
              </div>
              {captures.length === 0 ? (
                <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>No captures this week.</div>
              ) : (
                <div>
                  {captures.map((c, i) => {
                    const dayKey = getDayKey(c.timestamp)
                    const prevDayKey = i > 0 ? getDayKey(captures[i - 1].timestamp) : null
                    const showDivider = i > 0 && dayKey !== prevDayKey
                    const isSubItem = c.tag === 'sub_item'
                    const prevIsSubItemOfSameParent = i > 0 && captures[i - 1].tag === 'sub_item' && captures[i - 1].parent_name === c.parent_name
                    const showParentLabel = isSubItem && c.parent_name && !prevIsSubItemOfSameParent
                    return (
                      <div key={c.source_id + i}>
                        {showDivider && <div style={{ borderTop: '1px solid #E8E4DC', margin: '12px 0 10px' }} />}
                        {showParentLabel && (
                          <div style={{ fontSize: 11, color: '#8A857D', paddingLeft: 24, marginBottom: 2, marginTop: 4, fontStyle: 'italic' }}>
                            {c.parent_name}
                          </div>
                        )}
                        <CaptureEntryRow entry={c} onDelete={() => handleDeleteEntry(c)} editable={!isWeekCompleted} />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'create' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                What&apos;s on the books
              </div>
              {sortedLandscape.length === 0 ? (
                <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing scheduled yet.</div>
              ) : (
                <div>
                  {sortedLandscape.map((item, i) => {
                    const prevDate = i > 0 ? sortedLandscape[i - 1].committed_date : null
                    const showDivider = i > 0 && item.committed_date !== prevDate
                    const isCompleted = item.status === 'completed'
                    const isSkipped = item.status === 'skipped'
                    return (
                      <div key={item.id}>
                        {showDivider && <div style={{ borderTop: '1px solid #E8E4DC', margin: '12px 0 10px' }} />}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 10, color: '#C4BFB4', width: 56, flexShrink: 0, paddingTop: 3, textAlign: 'right' }}>
                            {fmtDayTime(item.committed_date, item.scheduled_time)}
                          </span>
                          <span style={{ width: 18, flexShrink: 0 }} />
                          <span style={{
                            fontSize: 14, color: isCompleted ? '#5A9E6F' : isSkipped ? '#B5B0A8' : '#2D2A26',
                            textDecoration: isSkipped ? 'line-through' : 'none',
                          }}>
                            {isCompleted && '✓ '}{item.name}
                            {item.scheduled_time && <span style={{ marginLeft: 5, fontSize: 10, color: '#4B82AF' }} title="scheduled">&#128339;</span>}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Panel ─────────────────────────────────────────────────── */}
        <div style={{ width: 360, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start' }}>

          {/* ── Complete tab ────────────────────────────────────────────────── */}
          {tab === 'complete' && (
            <>
              {/* Completed state banner */}
              {isWeekCompleted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 14, color: '#5A9E6F', fontWeight: 600 }}>Week completed</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={handleReopenWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B5B0A8' }}>Reopen</button>
                </div>
              )}

              {/* Intent */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>My intent for this week</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
                  {weekRecord?.create_statement ?? 'No intent was set.'}
                </div>
              </div>

              {/* Reflection */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reflect on this week</div>
                  <span onClick={() => setShowHelp(showHelp === 'complete' ? null : 'complete')} style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}>?</span>
                  {saved === 'complete_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
                </div>
                {showHelp === 'complete' && (
                  <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                    Looking back at the week through your own words helps you notice patterns, surprises, and the gap between intent and reality.
                  </div>
                )}
                {!isWeekCompleted && (
                  <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>
                    Was that what you expected? What did you feel and notice? What surprised you?
                  </div>
                )}
                {isWeekCompleted ? (
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: completeText ? '#2D2A26' : '#B5B0A8', fontStyle: completeText ? 'normal' : 'italic' }}>
                    {completeText || 'No reflection written.'}
                  </div>
                ) : (
                  <textarea
                    value={completeText}
                    onChange={e => { setCompleteText(e.target.value); autoSave('complete_statement', e.target.value) }}
                    onBlur={() => autoSave('complete_statement', completeText)}
                    rows={5}
                    style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Capture — only when not completed */}
              {!isWeekCompleted && (
                <div style={{ marginBottom: 16 }}>
                  <CaptureInput source="today" placeholder="Capture something..." onItemCreated={() => loadData()} onLogEntry={() => loadData()} />
                </div>
              )}

              {/* Complete button or flow link */}
              {!isWeekCompleted ? (
                <button
                  onClick={handleCompleteWeek}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                    background: '#5A9E6F', color: '#FFF', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT, marginBottom: 12,
                  }}
                >
                  Complete this week
                </button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <span onClick={() => setTab('create')} style={{ fontSize: 13, color: '#C4725A', cursor: 'pointer' }}>
                    Create next week →
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── Create tab ─────────────────────────────────────────────────── */}
          {tab === 'create' && (
            <>
              {isWeekCreated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 14, color: '#5A9E6F', fontWeight: 600 }}>Week created</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={handleReopenCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B5B0A8' }}>Reopen</button>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Set your intent</div>
                  <span onClick={() => setShowHelp(showHelp === 'create' ? null : 'create')} style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}>?</span>
                  {saved === 'create_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
                </div>
                {showHelp === 'create' && (
                  <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                    Setting intent for the week — not as a plan, but as a statement of expectation — gives next week&apos;s reflection something to compare against.
                  </div>
                )}
                {!isWeekCreated && (
                  <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>
                    What do you expect and intend for this coming week? What might be hard? What might be wonderful?
                  </div>
                )}
                {isWeekCreated ? (
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: createText ? '#2D2A26' : '#B5B0A8', fontStyle: createText ? 'normal' : 'italic' }}>
                    {createText || 'No intent written.'}
                  </div>
                ) : (
                  <textarea
                    value={createText}
                    onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value) }}
                    onBlur={() => autoSave('create_statement', createText)}
                    rows={5}
                    style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Capture — only when not created */}
              {!isWeekCreated && (
                <div style={{ marginBottom: 16 }}>
                  <CaptureInput source="organize" placeholder="Capture something..." onItemCreated={() => loadData()} onLogEntry={() => loadData()} />
                </div>
              )}

              {!isWeekCreated ? (
                <button
                  onClick={handleCreateWeek}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                    background: '#4B82AF', color: '#FFF', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT, marginBottom: 12,
                  }}
                >
                  Create this week
                </button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <a href="/organize" style={{ fontSize: 13, color: '#8A8578', textDecoration: 'none' }}>Organize this week →</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CaptureEntryRow ─────────────────────────────────────────────────────────

const LINE_HEIGHT = 1.6
const MAX_LINES = 5
const MAX_HEIGHT = `calc(${MAX_LINES} * ${LINE_HEIGHT}em)`

function CaptureEntryRow({ entry, onDelete, editable = true }: { entry: CaptureEntry; onDelete: () => void; editable?: boolean }) {
  const { timestamp, text, type, tag } = entry
  const isCompleted = type === 'completed'
  const isReflection = type === 'reflection'
  const isSkipped = tag === 'skipped'
  const isSubItem = tag === 'sub_item'
  const isScheduled = tag === 'scheduled'
  const isInProgress = tag === 'in_progress'
  const isDeletable = editable && (type === 'action_item' || type === 'day_log' || type === 'completed' || type === 'note')
  const [expanded, setExpanded] = useState(false)
  const [needsTruncation, setNeedsTruncation] = useState(false)
  const [hovered, setHovered] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    setNeedsTruncation(el.scrollHeight > el.clientHeight + 2)
  }, [text])

  return (
    <div
      style={{ display: 'flex', gap: 0, marginBottom: 8, alignItems: 'flex-start', paddingLeft: isSubItem ? 24 : 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 10, color: '#C4BFB4', width: 56, flexShrink: 0, paddingTop: 3, textAlign: 'right' }}>
        {fmtCapTimestamp(timestamp)}
      </span>
      <span style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
        {isDeletable && hovered ? (
          <button onClick={onDelete} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#C4504A', padding: 0, lineHeight: 1 }}>✕</button>
        ) : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          ref={textRef}
          style={{
            fontSize: 14, lineHeight: LINE_HEIGHT,
            color: isCompleted ? '#5A9E6F' : isSkipped ? '#B5B0A8' : isReflection ? '#8A8578' : '#2D2A26',
            textDecoration: isSkipped ? 'line-through' : 'none',
            display: 'block',
            maxHeight: expanded ? 'none' : MAX_HEIGHT, overflow: 'hidden',
          }}
        >
          {isCompleted && '✓ '}{text}
          {isScheduled && <span style={{ marginLeft: 5, fontSize: 10, color: '#4B82AF' }} title="scheduled">&#128339;</span>}
          {isInProgress && <span style={{ fontSize: 9, color: '#C4725A', marginLeft: 6, fontWeight: 500 }}>in progress</span>}
          {isSkipped && <span style={{ fontSize: 9, color: '#B5B0A8', marginLeft: 6 }}>skipped</span>}
        </span>
        {(needsTruncation || expanded) && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#8A857D', padding: '2px 0', fontFamily: FONT }}
          >{expanded ? '▲ less' : '▼ more'}</button>
        )}
      </div>
    </div>
  )
}
