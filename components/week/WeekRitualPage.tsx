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

  // This week's data (for Complete tab)
  const [weekRecord, setWeekRecord] = useState<WeekRecord | null>(null)
  const [captures, setCaptures] = useState<CaptureEntry[]>([])

  // Next week's data (for Create tab)
  const [nextWeekRecord, setNextWeekRecord] = useState<WeekRecord | null>(null)
  const [landscape, setLandscape] = useState<LandscapeItem[]>([])

  const [loading, setLoading] = useState(true)
  const [completeText, setCompleteText] = useState('')
  const [createText, setCreateText] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const NC = { cache: 'no-store' } as const
    const nextWeekEnd = addDaysStr(nextWeekStart, 6)
    const [weekRes, capsRes, nextWeekRes, landscapeRes] = await Promise.all([
      fetch(`/api/weeks/${weekStart}`, NC),
      fetch(`/api/weeks/${weekStart}/captures`, NC),
      fetch(`/api/weeks/${nextWeekStart}`, NC),
      // Landscape: committed action_items for next week
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
    // complete_statement saves to this week; create_statement saves to next week
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

  // ── Checkbox toggle ─────────────────────────────────────────────────────────

  async function toggleCheckbox(field: 'completed_at_ritual' | 'created_at_ritual' | 'organized_at' | 'deconflicted_at') {
    // Completed checkbox → this week's record; everything else → next week's record
    const isThisWeek = field === 'completed_at_ritual'
    const targetWeek = isThisWeek ? weekStart : nextWeekStart
    const record = isThisWeek ? weekRecord : nextWeekRecord
    const currentValue = record ? (record as unknown as Record<string, unknown>)[field] : null
    const newValue = currentValue ? null : new Date().toISOString()
    await fetch(`/api/weeks/${targetWeek}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newValue }),
    })
    const res = await fetch(`/api/weeks/${targetWeek}`, { cache: 'no-store' })
    const data = await res.json()
    if (isThisWeek) setWeekRecord(data)
    else setNextWeekRecord(data)
  }

  const isChecked = (field: string, record: WeekRecord | null) =>
    !!(record as unknown as Record<string, unknown> | null)?.[field]

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
    background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? '#2D2A26' : 'transparent'}`,
    fontFamily: FONT,
  })

  // Sort landscape by committed_date + scheduled_time
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
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          <button onClick={() => setTab('complete')} style={tabStyle(tab === 'complete')}>Complete</button>
          <button onClick={() => setTab('create')} style={tabStyle(tab === 'create')}>Create</button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px', display: 'flex', gap: 40 }}>

        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Complete tab: captures stream */}
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
                        <CaptureEntryRow entry={c} onDelete={() => handleDeleteEntry(c)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Create tab: landscape — what's on the books for next week */}
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

        {/* ── Right Panel: Ritual (sticky) ─────────────────────────────── */}
        <div style={{ width: 360, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start' }}>

          {/* Complete tab */}
          {tab === 'complete' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>My intent for this week</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
                  {weekRecord?.create_statement ?? 'No intent was set.'}
                </div>
              </div>
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
                <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>
                  Was that what you expected? What did you feel and notice? What surprised you?
                </div>
                <textarea
                  value={completeText}
                  onChange={e => { setCompleteText(e.target.value); autoSave('complete_statement', e.target.value) }}
                  onBlur={() => autoSave('complete_statement', completeText)}
                  rows={5}
                  style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          {/* Create tab */}
          {tab === 'create' && (
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
              <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>
                What do you expect and intend for this coming week? What might be hard? What might be wonderful?
              </div>
              <textarea
                value={createText}
                onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value) }}
                onBlur={() => autoSave('create_statement', createText)}
                rows={5}
                style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>
          )}

          {/* Checkboxes — Completed is this week, rest are next week */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <span onClick={() => toggleCheckbox('completed_at_ritual')} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, color: isChecked('completed_at_ritual', weekRecord) ? '#2D2A26' : '#B5B0A8' }}>
              <span style={checkboxStyle(isChecked('completed_at_ritual', weekRecord))}>{isChecked('completed_at_ritual', weekRecord) ? '✓' : ''}</span>
              Completed
            </span>
            {(['created_at_ritual', 'organized_at', 'deconflicted_at'] as const).map(field => {
              const label = field === 'created_at_ritual' ? 'Created' : field === 'organized_at' ? 'Organized' : 'De-conflicted'
              return (
                <span key={field} onClick={() => toggleCheckbox(field)} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, color: isChecked(field, nextWeekRecord) ? '#2D2A26' : '#B5B0A8' }}>
                  <span style={checkboxStyle(isChecked(field, nextWeekRecord))}>{isChecked(field, nextWeekRecord) ? '✓' : ''}</span>
                  {label}
                </span>
              )
            })}
          </div>

          {/* Capture */}
          <div style={{ marginBottom: 16 }}>
            <CaptureInput
              source={tab === 'complete' ? 'today' : 'organize'}
              placeholder="Capture something..."
              onItemCreated={() => loadData()}
              onLogEntry={() => loadData()}
            />
          </div>

          {/* Flow links */}
          <div style={{ display: 'flex', gap: 16 }}>
            {tab === 'complete' && (
              <span onClick={() => setTab('create')} style={{ fontSize: 12, color: '#C4725A', cursor: 'pointer' }}>
                Create next week →
              </span>
            )}
            {tab === 'create' && (
              <a href="/organize" style={{ fontSize: 12, color: '#8A8578', textDecoration: 'none' }}>Organize this week →</a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CaptureEntryRow ─────────────────────────────────────────────────────────

const LINE_HEIGHT = 1.6
const MAX_LINES = 5
const MAX_HEIGHT = `calc(${MAX_LINES} * ${LINE_HEIGHT}em)`

function CaptureEntryRow({ entry, onDelete }: { entry: CaptureEntry; onDelete: () => void }) {
  const { timestamp, text, type, tag } = entry
  const isCompleted = type === 'completed'
  const isReflection = type === 'reflection'
  const isSkipped = tag === 'skipped'
  const isSubItem = tag === 'sub_item'
  const isScheduled = tag === 'scheduled'
  const isInProgress = tag === 'in_progress'
  const isDeletable = type === 'action_item' || type === 'day_log' || type === 'completed' || type === 'note'
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
