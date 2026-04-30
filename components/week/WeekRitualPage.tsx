'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CaptureInput from '@/components/capture/CaptureInput'
import { COLORS } from '@/lib/theme'

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
  category: 'committed' | 'returning' | 'carried' | 'routine' | 'span'
  date?: string | null
  time?: string | null
  status?: string
  time_type?: string
  frequency?: string
  start_date?: string
  end_date?: string
  color?: string | null
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
  const [thisWeekLandscape, setThisWeekLandscape] = useState<LandscapeItem[]>([])

  const [loading, setLoading] = useState(true)
  const [completeText, setCompleteText] = useState('')
  const [createText, setCreateText] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWeekCompleted = !!weekRecord?.completed_at_ritual
  const isWeekCreated = !!nextWeekRecord?.created_at_ritual

  // Week timing
  const todayDate = new Date().toISOString().split('T')[0]
  const weekEndDate = addDaysStr(weekStart, 6)
  const isPast = weekEndDate < todayDate
  const isFuture = weekStart > todayDate
  const isCurrentWeek = !isPast && !isFuture
  const isSunday = todayDate === weekEndDate

  // Display modes
  const isCompletedPast = isPast && isWeekCompleted               // unified read-only record
  const isUncompletedPast = isPast && !isWeekCompleted             // Complete/Create tabs (catch up)
  const isRitualTime = isCurrentWeek && isSunday                   // Complete/Create tabs
  const isMidWeek = isCurrentWeek && !isSunday                     // live view: intent + items by day
  const isFutureWeek = isFuture                                    // Create only
  const showTabs = isUncompletedPast || isRitualTime

  // Relative week label
  const todayD = new Date(todayDate + 'T12:00:00')
  const todayDayOfWeek = todayD.getDay()
  const todayMondayOffset = todayDayOfWeek === 0 ? -6 : 1 - todayDayOfWeek
  const currentWeekMonday = addDaysStr(todayDate, todayMondayOffset)
  const lastWeekMonday = addWeeks(currentWeekMonday, -1)
  const nextWeekMonday = addWeeks(currentWeekMonday, 1)
  const weekLabel = weekStart === currentWeekMonday ? 'Current Week'
    : weekStart === lastWeekMonday ? 'Last Week'
    : weekStart === nextWeekMonday ? 'Next Week'
    : null

  const loadData = useCallback(async () => {
    setLoading(true)
    const NC = { cache: 'no-store' } as const
    const [weekRes, capsRes, nextWeekRes, landscapeRes, thisLandscapeRes] = await Promise.all([
      fetch(`/api/weeks/${weekStart}`, NC),
      fetch(`/api/weeks/${weekStart}/captures`, NC),
      fetch(`/api/weeks/${nextWeekStart}`, NC),
      fetch(`/api/weeks/${nextWeekStart}/landscape`, NC),
      fetch(`/api/weeks/${weekStart}/landscape`, NC),
    ])
    const weekData = await weekRes.json()
    const capsData = await capsRes.json()
    const nextWeekData = await nextWeekRes.json()
    const landscapeData = await landscapeRes.json()
    const thisLandscapeData = await thisLandscapeRes.json()

    setWeekRecord(weekData?.id ? weekData : null)
    setCaptures(Array.isArray(capsData) ? capsData : [])
    setNextWeekRecord(nextWeekData?.id ? nextWeekData : null)
    const all: LandscapeItem[] = [
      ...(landscapeData.committed ?? []),
      ...(landscapeData.parked ?? []),
      ...(landscapeData.carried ?? []),
      ...(landscapeData.routines ?? []),
      ...(landscapeData.spans ?? []),
    ]
    setLandscape(all)
    const thisAll: LandscapeItem[] = [
      ...(thisLandscapeData.committed ?? []),
      ...(thisLandscapeData.parked ?? []),
      ...(thisLandscapeData.carried ?? []),
      ...(thisLandscapeData.spans ?? []),
    ]
    setThisWeekLandscape(thisAll)
    setCompleteText(weekData?.complete_statement ?? '')
    setCreateText(nextWeekData?.create_statement ?? '')
    // For future weeks, the intent is on the week itself
    if (weekStart > new Date().toISOString().split('T')[0]) {
      setCreateText(weekData?.create_statement ?? '')
    }
    // Default tab: completed → create, otherwise complete
    setTab(weekData?.completed_at_ritual ? 'create' : 'complete')
    setLoading(false)
  }, [weekStart, nextWeekStart])

  useEffect(() => { loadData() }, [loadData])

  // ── Auto-save ───────────────────────────────────────────────────────────────

  function autoSave(field: 'complete_statement' | 'create_statement', value: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const targetWeek = field === 'complete_statement' ? weekStart : (isFuture ? weekStart : nextWeekStart)
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

  function renderLandscapeSection(items: LandscapeItem[], label: string, labelColor: string) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {label}
        </div>
        {items.map(item => {
          const isCompleted = item.status === 'completed'
          const isInProgress = item.status === 'in_progress'
          return (
            <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: '#C4BFB4', width: 56, flexShrink: 0, paddingTop: 3, textAlign: 'right' }}>
                {item.date ? fmtDayTime(item.date, item.time ?? null) : ''}
              </span>
              <span style={{ width: 18, flexShrink: 0 }} />
              <span style={{
                fontSize: 14,
                color: isCompleted ? '#5A9E6F' : isInProgress ? COLORS.primary : '#2D2A26',
              }}>
                {isCompleted && '✓ '}{item.name}
                {item.time && <span style={{ marginLeft: 5, fontSize: 10, color: '#4B82AF' }} title="scheduled">&#128339;</span>}
                {isInProgress && <span style={{ fontSize: 9, color: COLORS.primary, marginLeft: 6 }}>in progress</span>}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  function renderSpanSection(items: LandscapeItem[]) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        {items.map(item => {
          const startD = new Date(item.start_date + 'T12:00:00')
          const endD = new Date(item.end_date + 'T12:00:00')
          const fmtD = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const sameDay = item.start_date === item.end_date
          return (
            <div key={item.id} style={{
              padding: '4px 10px', marginBottom: 4,
              borderRadius: 4,
              background: `${item.color ?? '#8A857D'}18`,
              borderLeft: `3px solid ${item.color ?? '#8A857D'}`,
              maxWidth: '75%',
            }}>
              <span style={{ fontSize: 12, color: '#2D2A26' }}>{item.name}</span>
            </div>
          )
        })}
      </div>
    )
  }

  function renderRoutineSection(items: LandscapeItem[]) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#4B82AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Routines due
        </div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, color: '#C4BFB4', width: 56, flexShrink: 0, paddingTop: 3, textAlign: 'right' }}>
              {item.frequency ?? ''}
            </span>
            <span style={{ width: 18, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#4B82AF' }}>
              {item.name}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function renderCapturesStream(caps: CaptureEntry[], editable: boolean) {
    if (caps.length === 0) return <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>No captures this week.</div>
    return (
      <div>
        {caps.map((c, i) => {
          const dayKey = getDayKey(c.timestamp)
          const prevDayKey = i > 0 ? getDayKey(caps[i - 1].timestamp) : null
          const showDivider = i > 0 && dayKey !== prevDayKey
          const isSubItem = c.tag === 'sub_item'
          const prevIsSubItemOfSameParent = i > 0 && caps[i - 1].tag === 'sub_item' && caps[i - 1].parent_name === c.parent_name
          const showParentLabel = isSubItem && c.parent_name && !prevIsSubItemOfSameParent
          return (
            <div key={c.source_id + i}>
              {showDivider && <div style={{ borderTop: '1px solid #E8E4DC', margin: '12px 0 10px' }} />}
              {showParentLabel && (
                <div style={{ fontSize: 11, color: '#8A857D', paddingLeft: 24, marginBottom: 2, marginTop: 4, fontStyle: 'italic' }}>{c.parent_name}</div>
              )}
              <CaptureEntryRow entry={c} onDelete={() => handleDeleteEntry(c)} editable={editable} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      <style>{`
        .week-panels { display: flex; gap: 40px; }
        .week-panel-left { flex: 1; min-width: 0; }
        .week-panel-right { width: 360px; flex-shrink: 0; position: sticky; top: 24px; align-self: flex-start; }
        @media (max-width: 768px) {
          .week-panels { flex-direction: column; gap: 24px; }
          .week-panel-right { width: 100%; position: static; }
        }
      `}</style>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.push(`/week/${addWeeks(weekStart, -1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>←</button>
          <div style={{ flex: 1 }}>
            {weekLabel && <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2A26', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{weekLabel}</div>}
            <div style={{ fontSize: 14, color: '#8A8578' }}>
              {isFutureWeek ? friendlyRange(weekStart) : showTabs && tab === 'create' ? friendlyRange(nextWeekStart) : friendlyRange(weekStart)}
            </div>
          </div>
          <button onClick={() => router.push(`/week/${addWeeks(weekStart, 1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>→</button>
        </div>
        {showTabs && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => setTab('complete')} style={tabStyle(tab === 'complete')}>
              Complete {isWeekCompleted && <span style={{ color: '#5A9E6F', marginLeft: 4 }}>✓</span>}
            </button>
            <button onClick={() => setTab('create')} style={tabStyle(tab === 'create')}>
              Create {isWeekCreated && <span style={{ color: '#5A9E6F', marginLeft: 4 }}>✓</span>}
            </button>
          </div>
        )}
        {!showTabs && <div style={{ height: 12 }} />}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           MODE 1: Completed past week — unified read-only record
           ═══════════════════════════════════════════════════════════════════ */}
      {isCompletedPast && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }} className="week-panels">
          <div className="week-panel-left">
            <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Intent</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
                  {weekRecord?.create_statement ?? 'No intent was set.'}
                </div>
              </div>
              {weekRecord?.complete_statement && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Reflection</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: '#2D2A26' }}>{weekRecord.complete_statement}</div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>This week, in your words</div>
            {renderCapturesStream(captures, false)}
          </div>
          <div className="week-panel-right">
            <button onClick={handleReopenWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B5B0A8' }}>Reopen week</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           MODE 2: Mid-week current week — live view: intent + items by day
           ═══════════════════════════════════════════════════════════════════ */}
      {isMidWeek && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
          {/* Intent */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Intent</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
              {weekRecord?.create_statement ?? 'No intent was set.'}
            </div>
          </div>

          {/* Items by day */}
          {(() => {
            const byDay: Record<string, LandscapeItem[]> = {}
            for (const item of thisWeekLandscape) {
              const d = item.date ?? weekStart
              if (!byDay[d]) byDay[d] = []
              byDay[d].push(item)
            }
            const days = Object.keys(byDay).sort()
            if (days.length === 0) return <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing scheduled this week yet.</div>
            return days.map(day => {
              const d = new Date(day + 'T12:00:00')
              const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
              const isToday = day === todayDate
              const isPastDay = day < todayDate
              return (
                <div key={day} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? COLORS.primary : '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, borderTop: '1px solid #F0EDE8', paddingTop: 8 }}>
                    {dayLabel}{isToday && ' — today'}
                  </div>
                  {byDay[day].map(item => {
                    const isCompleted = item.status === 'completed'
                    const isInProgress = item.status === 'in_progress'
                    return (
                      <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start', opacity: isPastDay && !isToday ? 0.6 : 1 }}>
                        {item.time && <span style={{ fontSize: 11, color: '#B5B0A8', width: 48, flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>{fmtDayTime(day, item.time).split(' ')[1]}</span>}
                        {!item.time && <span style={{ width: 48, flexShrink: 0 }} />}
                        <span style={{
                          fontSize: 14,
                          color: isCompleted ? '#5A9E6F' : isInProgress ? COLORS.primary : '#2D2A26',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}>
                          {isCompleted && '✓ '}{item.name}
                          {isInProgress && <span style={{ fontSize: 9, color: COLORS.primary, marginLeft: 6 }}>in progress</span>}
                        </span>
                        {item.category === 'returning' && <span style={{ fontSize: 9, color: '#9B7EC8', marginLeft: 4 }}>returning</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}

          {/* Unscheduled / carried items */}
          {thisWeekLandscape.filter(i => !i.date && i.category === 'carried').length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, borderTop: '1px solid #F0EDE8', paddingTop: 8 }}>Still open</div>
              {thisWeekLandscape.filter(i => !i.date && i.category === 'carried').map(item => (
                <div key={item.id} style={{ fontSize: 14, color: '#8A857D', marginBottom: 4, paddingLeft: 56 }}>{item.name}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           MODE 3: Future week — Create intent only
           ═══════════════════════════════════════════════════════════════════ */}
      {isFutureWeek && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }} className="week-panels">
          <div className="week-panel-left">
            {landscape.length === 0 ? (
              <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing on the horizon yet.</div>
            ) : (
              <div>
                {renderSpanSection(landscape.filter(i => i.category === 'span'))}
                {renderLandscapeSection(landscape.filter(i => i.category === 'committed'), 'Scheduled', '#2D2A26')}
                {renderLandscapeSection(landscape.filter(i => i.category === 'returning'), 'Returning', COLORS.primary)}
                {renderLandscapeSection(landscape.filter(i => i.category === 'carried'), 'Still open', '#8A857D')}
                {renderRoutineSection(landscape.filter(i => i.category === 'routine'))}
              </div>
            )}
          </div>
          <div className="week-panel-right">
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Set your intent</div>
                {saved === 'create_statement' && <span style={{ fontSize: 10, fontWeight: 600, color: '#2E7D32', padding: '2px 6px', background: '#FFF', border: '1px solid #5A9E6F', borderRadius: 4, boxShadow: '0 0 6px rgba(90,158,111,0.3)' }}>saved</span>}
              </div>
              <textarea
                value={createText}
                onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value) }}
                onBlur={() => autoSave('create_statement', createText)}
                rows={5}
                placeholder="What do you expect and intend for this week?"
                style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           MODE 4 & 5: Tab-based workflow (uncompleted past / ritual Sunday)
           ═══════════════════════════════════════════════════════════════════ */}
      {showTabs && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }} className="week-panels">
          <div className="week-panel-left">
            {tab === 'complete' && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>This week, in your words</div>
                {renderCapturesStream(captures, !isWeekCompleted)}
              </>
            )}
            {tab === 'create' && (
              <>
                {landscape.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing on the horizon yet.</div>
                ) : (
                  <div>
                    {renderSpanSection(landscape.filter(i => i.category === 'span'))}
                    {renderLandscapeSection(landscape.filter(i => i.category === 'committed'), 'Scheduled', '#2D2A26')}
                    {renderLandscapeSection(landscape.filter(i => i.category === 'returning'), 'Returning', COLORS.primary)}
                    {renderLandscapeSection(landscape.filter(i => i.category === 'carried'), 'Still open', '#8A857D')}
                    {renderRoutineSection(landscape.filter(i => i.category === 'routine'))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="week-panel-right">
            {tab === 'complete' && (
              <>
                {isWeekCompleted && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 14, color: '#5A9E6F', fontWeight: 600 }}>Week completed</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={handleReopenWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B5B0A8' }}>Reopen</button>
                  </div>
                )}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>My intent for this week</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: weekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: weekRecord?.create_statement ? 'normal' : 'italic' }}>
                    {weekRecord?.create_statement ?? 'No intent was set.'}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reflect on this week</div>
                    {saved === 'complete_statement' && <span style={{ fontSize: 10, fontWeight: 600, color: '#2E7D32', padding: '2px 6px', background: '#FFF', border: '1px solid #5A9E6F', borderRadius: 4, boxShadow: '0 0 6px rgba(90,158,111,0.3)' }}>saved</span>}
                  </div>
                  {!isWeekCompleted && (
                    <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>Was that what you expected? What did you feel and notice? What surprised you?</div>
                  )}
                  {isWeekCompleted ? (
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: completeText ? '#2D2A26' : '#B5B0A8', fontStyle: completeText ? 'normal' : 'italic' }}>{completeText || 'No reflection written.'}</div>
                  ) : (
                    <textarea value={completeText} onChange={e => { setCompleteText(e.target.value); autoSave('complete_statement', e.target.value) }} onBlur={() => autoSave('complete_statement', completeText)} rows={5}
                      style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }} />
                  )}
                </div>
                {!isWeekCompleted && (
                  <div style={{ marginBottom: 16 }}>
                    <CaptureInput source="today" placeholder="Capture something..." onItemCreated={() => loadData()} onLogEntry={() => loadData()} />
                  </div>
                )}
                {!isWeekCompleted ? (
                  <button onClick={handleCompleteWeek} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: '#5A9E6F', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 12 }}>
                    Complete this week
                  </button>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <span onClick={() => setTab('create')} style={{ fontSize: 13, color: COLORS.primary, cursor: 'pointer' }}>Create next week →</span>
                  </div>
                )}
              </>
            )}
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
                    {saved === 'create_statement' && <span style={{ fontSize: 10, fontWeight: 600, color: '#2E7D32', padding: '2px 6px', background: '#FFF', border: '1px solid #5A9E6F', borderRadius: 4, boxShadow: '0 0 6px rgba(90,158,111,0.3)' }}>saved</span>}
                  </div>
                  {!isWeekCreated && (
                    <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>What do you expect and intend for this coming week?</div>
                  )}
                  {isWeekCreated ? (
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: createText ? '#2D2A26' : '#B5B0A8', fontStyle: createText ? 'normal' : 'italic' }}>{createText || 'No intent written.'}</div>
                  ) : (
                    <textarea value={createText} onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value) }} onBlur={() => autoSave('create_statement', createText)} rows={5}
                      style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }} />
                  )}
                </div>
                {!isWeekCreated && (
                  <div style={{ marginBottom: 16 }}>
                    <CaptureInput source="organize" placeholder="Capture something..." onItemCreated={() => loadData()} onLogEntry={() => loadData()} />
                  </div>
                )}
                {!isWeekCreated ? (
                  <button onClick={handleCreateWeek} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: '#4B82AF', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 12 }}>
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
      )}
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
  const isLog = type === 'day_log'
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
      style={{
        display: 'flex', gap: 0, marginBottom: 8, alignItems: 'flex-start',
        paddingLeft: isSubItem ? 24 : 0,
        ...(isLog ? { borderLeft: `3px solid ${COLORS.primaryMuted}`, paddingLeft: 8, marginLeft: isSubItem ? 24 : 0, background: '#FDF9F7', borderRadius: 2, padding: '4px 0 4px 8px' } : {}),
        ...(isReflection ? { borderLeft: '3px solid #8A857D40', paddingLeft: 8, background: '#F8F7F4', borderRadius: 2, padding: '4px 0 4px 8px' } : {}),
      }}
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
          {isInProgress && <span style={{ fontSize: 9, color: COLORS.primary, marginLeft: 6, fontWeight: 500 }}>in progress</span>}
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
