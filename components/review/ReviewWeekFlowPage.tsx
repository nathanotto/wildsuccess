'use client'
import { useState, useEffect, useCallback } from 'react'
import ReviewSubNav from './ReviewSubNav'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MOOD_COLORS: Record<number, string> = { 5: '#5A9E6F', 4: '#5A9E6F', 3: '#BA7517', 2: '#B8443E', 1: '#B8443E' }
const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  completed: { icon: '✓', color: '#5A9E6F' },
  skipped: { icon: '×', color: '#B8443E' },
  rescheduled: { icon: '↺', color: '#8A857D' },
  parked: { icon: '◧', color: '#8A857D' },
  in_progress: { icon: '□', color: '#D0CBC3' },
  committed: { icon: '□', color: '#D0CBC3' },
}

const TIME_TYPE_COLORS: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }

interface StreamEntry {
  time: string
  type: 'action_item' | 'logged'
  name?: string
  status?: string
  text?: string
  time_type?: string
}

interface DayData {
  date: string
  day_of_week: string
  reflection: { wins: string | null; friction: string | null; journal_note: string | null; mood_energy: number | null } | null
  stream: StreamEntry[]
}

interface SpanData {
  id: string; name: string; start_date: string; end_date: string; color: string | null; person_name: string | null
}

interface WeekFlowData {
  week_start: string
  spans: SpanData[]
  days: DayData[]
}

function getMondayOf(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1))
  return toDS(dt)
}
function toDS(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addWeeks(ds: string, n: number) {
  const d = new Date(ds + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return toDS(d)
}
function fmtTime(t: string) {
  const [hh, mm] = t.split(':').map(Number)
  const ampm = hh >= 12 ? 'p' : 'a'
  const h = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${h}:${String(mm).padStart(2, '0')}${ampm}`
}
function fmtShortDate(ds: string) {
  const d = new Date(ds + 'T12:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export default function ReviewWeekFlowPage() {
  const [weekStart, setWeekStart] = useState(() => addWeeks(getMondayOf(new Date()), -1))
  const [data, setData] = useState<WeekFlowData | null>(null)
  const [loading, setLoading] = useState(true)

  const thisMonday = getMondayOf(new Date())
  const canGoForward = weekStart < thisMonday

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/review/weekflow?week_start=${weekStart}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  // Week label
  const startD = new Date(weekStart + 'T12:00:00')
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const weekLabel = `Week of ${months[startD.getMonth()]} ${startD.getDate()}`

  const diff = Math.round((new Date(thisMonday + 'T12:00:00').getTime() - new Date(weekStart + 'T12:00:00').getTime()) / (7 * 86400000))
  const relLabel = diff === 0 ? 'This week' : diff === 1 ? 'Last week' : `${diff} weeks ago`

  return (
    <div style={{ fontFamily: FONT, color: '#2D2A26', maxWidth: 960, margin: '0 auto', padding: '0 12px 60px' }}>
      <ReviewSubNav />

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 0 6px' }}>
        <button
          onClick={() => setWeekStart(s => addWeeks(s, -1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A857D', padding: '4px 8px' }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2D2A26' }}>{weekLabel}</div>
          <div style={{ fontSize: 12, color: '#8A857D' }}>{relLabel}</div>
        </div>
        <button
          onClick={() => canGoForward && setWeekStart(s => addWeeks(s, 1))}
          style={{ background: 'none', border: 'none', cursor: canGoForward ? 'pointer' : 'default', fontSize: 18, color: canGoForward ? '#8A857D' : '#E8E4DC', padding: '4px 8px' }}
        >›</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#B5B0A8', fontSize: 13 }}>Loading…</div>}

      {!loading && data && (
        <>
          {/* Day spans */}
          {data.spans.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {data.spans.map(span => {
                const clampedStart = span.start_date < weekStart ? weekStart : span.start_date
                const endStr = addWeeks(weekStart, 0) // weekStart
                const weekEndStr = toDS(new Date(new Date(weekStart + 'T12:00:00').getTime() + 6 * 86400000))
                const clampedEnd = span.end_date > weekEndStr ? weekEndStr : span.end_date
                const startCol = Math.max(0, Math.floor((new Date(clampedStart + 'T12:00:00').getTime() - new Date(weekStart + 'T12:00:00').getTime()) / 86400000))
                const endCol = Math.min(6, Math.floor((new Date(clampedEnd + 'T12:00:00').getTime() - new Date(weekStart + 'T12:00:00').getTime()) / 86400000))
                const leftPct = (startCol / 7) * 100
                const widthPct = ((endCol - startCol + 1) / 7) * 100
                const spanColor = span.color || '#E8E4DC'
                return (
                  <div key={span.id} style={{ position: 'relative', height: 22, marginBottom: 2 }}>
                    <div style={{
                      position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, height: 22,
                      background: `${spanColor}33`, borderLeft: `3px solid ${spanColor}`, borderRadius: 2,
                      display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden',
                    }}>
                      <span style={{ fontSize: 11, color: '#2D2A26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {span.name}
                        {span.person_name && <span style={{ color: '#8A857D', marginLeft: 4 }}>· {span.person_name}</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Seven columns */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {data.days.map((day, i) => {
              const mood = day.reflection?.mood_energy
              const hasReflection = day.reflection && (day.reflection.wins || day.reflection.friction || day.reflection.journal_note)

              return (
                <div
                  key={day.date}
                  style={{
                    flex: '1 0 130px',
                    minWidth: 130,
                    borderRight: i < 6 ? '1px solid #E8E4DC' : 'none',
                    padding: '0 6px',
                  }}
                >
                  {/* Column header */}
                  <div style={{ textAlign: 'center', padding: '10px 0 6px', borderBottom: '1px solid #F0EDE8' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2A26' }}>{DAY_ABBR[i]}</div>
                    <div style={{ fontSize: 12, color: '#8A857D', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {fmtShortDate(day.date)}
                      {mood != null && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: MOOD_COLORS[mood] ?? '#D0CBC3',
                          display: 'inline-block', flexShrink: 0,
                        }} />
                      )}
                    </div>
                  </div>

                  {/* Reflection section */}
                  {hasReflection && (
                    <div style={{ padding: '6px 0', borderBottom: '1px solid #F0EDE8' }}>
                      {day.reflection!.wins && (
                        <ReflectionLine label="W" text={day.reflection!.wins} />
                      )}
                      {day.reflection!.friction && (
                        <ReflectionLine label="F" text={day.reflection!.friction} />
                      )}
                      {day.reflection!.journal_note && (
                        <ReflectionLine label="J" text={day.reflection!.journal_note} />
                      )}
                    </div>
                  )}

                  {/* Stream */}
                  <div style={{ padding: '6px 0' }}>
                    {day.stream.length === 0 && !hasReflection && (
                      <div style={{ fontSize: 11, color: '#D0CBC3', textAlign: 'center', padding: '16px 0' }}>No data</div>
                    )}
                    {day.stream.map((entry, j) => (
                      <div key={j} style={{ display: 'flex', gap: 4, padding: '3px 0', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, color: '#B5B0A8', flexShrink: 0, width: 38, textAlign: 'right', marginTop: 1 }}>
                          {fmtTime(entry.time)}
                        </span>
                        {entry.type === 'action_item' ? (
                          <>
                            <span style={{
                              fontSize: 10, flexShrink: 0, width: 12, textAlign: 'center', marginTop: 1,
                              color: STATUS_ICONS[entry.status!]?.color ?? '#D0CBC3',
                            }}>
                              {STATUS_ICONS[entry.status!]?.icon ?? '□'}
                            </span>
                            <span style={{
                              fontSize: 12,
                              color: (entry.status === 'skipped' || entry.status === 'rescheduled') ? '#B5B0A8' : (TIME_TYPE_COLORS[entry.time_type ?? 'B'] ?? '#2D2A26'),
                              opacity: (entry.status === 'skipped' || entry.status === 'rescheduled') ? 0.5 : 1,
                            }}>
                              {entry.name}
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: '#8A857D', fontStyle: 'italic', marginLeft: 12 }}>
                            {entry.text}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week summary */}
          {(() => {
            const allStream = data.days.flatMap(d => d.stream)
            const completed = allStream.filter(e => e.type === 'action_item' && e.status === 'completed').length
            const logged = allStream.filter(e => e.type === 'logged').length
            const skippedRescheduled = allStream.filter(e => e.type === 'action_item' && (e.status === 'skipped' || e.status === 'rescheduled')).length
            if (completed + logged + skippedRescheduled === 0) return null
            return (
              <div style={{
                display: 'flex', gap: 16, justifyContent: 'center', padding: '14px 0', marginTop: 8,
                borderTop: '1px solid #E8E4DC', fontSize: 11, color: '#8A857D',
              }}>
                {completed > 0 && <span>{completed} completed</span>}
                {logged > 0 && <span>{logged} logged</span>}
                {skippedRescheduled > 0 && <span>{skippedRescheduled} skipped/rescheduled</span>}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

function ReflectionLine({ label, text }: { label: string; text: string }) {
  return (
    <div
      title={text}
      style={{
        fontSize: 11, color: '#8A857D', fontStyle: 'italic', marginBottom: 2,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}
    >
      <span style={{ fontWeight: 600, fontStyle: 'normal', marginRight: 3 }}>{label}:</span>
      {text}
    </div>
  )
}
