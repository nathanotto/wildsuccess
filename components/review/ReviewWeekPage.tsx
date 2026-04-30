'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import ReviewSubNav from './ReviewSubNav'
import { COLORS } from '@/lib/theme'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EC: Record<string, string> = { A: COLORS.primary, B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Connection', D: 'Restore', '0': 'Open' }
const MOOD_COLORS: Record<number, string> = { 5: '#5A9E6F', 4: '#5A9E6F', 3: '#BA7517', 2: '#B8443E', 1: '#B8443E' }

function getMondayOf(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1))
  return toDateStr(dt)
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addWeeks(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return toDateStr(d)
}

function weekRelativeLabel(weekStart: string): { label: string; color: string } {
  const today = new Date()
  const thisMonday = getMondayOf(today)
  if (weekStart === thisMonday) return { label: 'This Week', color: '#2D2A26' }
  const lastMonday = addWeeks(thisMonday, -1)
  if (weekStart === lastMonday) return { label: 'Last Week', color: '#5A5650' }
  const diff = Math.round((new Date(thisMonday + 'T12:00:00').getTime() - new Date(weekStart + 'T12:00:00').getTime()) / (7 * 86400000))
  if (diff > 0) return { label: `${diff} weeks ago`, color: '#8A857D' }
  return { label: `${-diff} week${diff === -1 ? '' : 's'} from now`, color: '#8A857D' }
}

interface WeekData {
  completed: { id: string; name: string; completed_at: string | null }[]
  incomplete: { id: string; name: string; status: string }[]
  completionRate: number
  completedCount: number
  totalCount: number
  timeBalance: Record<string, number>
  moods: { date: string; mood_energy: number | null }[]
  dailyWins: { date: string; wins: string }[]
  dailyFriction: { date: string; friction: string }[]
  logged: { id: string; note: string; event_date: string }[]
  spans: { id: string; name: string; start_date: string; end_date: string; color: string | null }[]
  valueEffort: { value_id: string; value_name: string; effort: number }[]
  reflection: { what_worked: string | null; what_to_change: string | null; notes: string | null } | null
  metadata: { weekStart: string; weekEnd: string; weekLabel: string }
}

export default function ReviewWeekPage() {
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
  const [data, setData] = useState<WeekData | null>(null)
  const [loading, setLoading] = useState(true)

  // Reflection fields (local state, auto-save on blur)
  const [whatWorked, setWhatWorked] = useState('')
  const [whatToChange, setWhatToChange] = useState('')
  const [notes, setNotes] = useState('')
  const reflectionLoaded = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/review/week?week_start=${weekStart}`)
      if (res.ok) {
        const d: WeekData = await res.json()
        setData(d)
        setWhatWorked(d.reflection?.what_worked ?? '')
        setWhatToChange(d.reflection?.what_to_change ?? '')
        setNotes(d.reflection?.notes ?? '')
        reflectionLoaded.current = true
      }
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  async function saveReflection() {
    if (!reflectionLoaded.current) return
    await fetch('/api/review/week/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start: weekStart,
        what_worked: whatWorked || null,
        what_to_change: whatToChange || null,
        notes: notes || null,
      }),
    })
  }

  const rel = weekRelativeLabel(weekStart)
  const totalMinutes = data ? Object.values(data.timeBalance).reduce((a, b) => a + b, 0) : 0

  return (
    <div style={{ fontFamily: FONT, color: '#2D2A26', maxWidth: 700, margin: '0 auto', padding: '0 16px 60px' }}>
      <ReviewSubNav />

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 0 8px' }}>
        <button
          onClick={() => setWeekStart(s => addWeeks(s, -1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A857D', padding: '4px 8px' }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: rel.color }}>{rel.label}</div>
          <div style={{ fontSize: 12, color: '#8A857D' }}>{data?.metadata.weekLabel ?? ''}</div>
        </div>
        <button
          onClick={() => setWeekStart(s => addWeeks(s, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A857D', padding: '4px 8px' }}
        >›</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#B5B0A8', fontSize: 13 }}>Loading…</div>}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {/* Completion rate */}
            <div style={{ flex: 1, background: '#FFF', border: '1px solid #F0EDE8', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Completed</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2D2A26' }}>
                {data.completedCount}<span style={{ fontSize: 14, fontWeight: 400, color: '#8A857D' }}>/{data.totalCount}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#F0EDE8', marginTop: 8 }}>
                <div style={{ height: 4, borderRadius: 2, background: '#5A9E6F', width: `${data.completionRate}%`, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Mood arc */}
            <div style={{ flex: 1, background: '#FFF', border: '1px solid #F0EDE8', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Mood</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 32 }}>
                {data.moods.map((m, i) => (
                  <div key={m.date} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', margin: '0 auto',
                      background: m.mood_energy ? (MOOD_COLORS[m.mood_energy] ?? '#D0CBC3') : '#E8E4DC',
                    }} />
                    <div style={{ fontSize: 8, color: '#B5B0A8', marginTop: 3 }}>{DAY_LABELS[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time balance */}
          {totalMinutes > 0 && (
            <div style={{ background: '#FFF', border: '1px solid #F0EDE8', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Time Balance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['A', 'B', 'C', 'D', '0'] as const).map(type => {
                  const mins = data.timeBalance[type] ?? 0
                  if (mins === 0) return null
                  const pct = (mins / totalMinutes) * 100
                  const hours = Math.floor(mins / 60)
                  const rem = mins % 60
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#8A857D', width: 55, flexShrink: 0 }}>{EL[type]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F0EDE8' }}>
                        <div style={{ height: 6, borderRadius: 3, background: EC[type], width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#8A857D', width: 40, textAlign: 'right', flexShrink: 0 }}>
                        {hours > 0 ? `${hours}h` : ''}{rem > 0 ? `${rem}m` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Day spans */}
          {data.spans.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Spans</div>
              {data.spans.map(span => (
                <div key={span.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 4,
                  background: (span.color ?? '#E8E4DC') + '20',
                  borderLeft: `3px solid ${span.color ?? '#E8E4DC'}`,
                  borderRadius: 2, fontSize: 12, color: '#2D2A26',
                }}>
                  <span>{span.name}</span>
                  <span style={{ fontSize: 10, color: '#8A857D' }}>
                    {new Date(span.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    –{new Date(span.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Values effort */}
          {data.valueEffort.length > 0 && (
            <div style={{ background: '#FFF', border: '1px solid #F0EDE8', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Values Effort</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.valueEffort.map(v => (
                  <div key={v.value_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#2D2A26' }}>{v.value_name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#5A9E6F' }}>{v.effort}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed items */}
          {data.completed.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Done</div>
              {data.completed.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F5F3EF' }}>
                  <span style={{ fontSize: 13, color: '#5A9E6F' }}>✓</span>
                  <span style={{ fontSize: 13, color: '#8A857D', textDecoration: 'line-through' }}>{item.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Incomplete items */}
          {data.incomplete.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Incomplete</div>
              {data.incomplete.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F5F3EF' }}>
                  <span style={{ fontSize: 13, color: '#D0CBC3' }}>○</span>
                  <span style={{ fontSize: 13, color: '#B5B0A8' }}>{item.name}</span>
                  {item.status !== 'committed' && (
                    <span style={{ fontSize: 9, color: '#B5B0A8', marginLeft: 'auto' }}>{item.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Daily wins */}
          {data.dailyWins.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Wins</div>
              {data.dailyWins.map(w => (
                <div key={w.date} style={{ padding: '4px 0', borderBottom: '1px solid #F5F3EF' }}>
                  <span style={{ fontSize: 10, color: '#B5B0A8' }}>{new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })} </span>
                  <span style={{ fontSize: 13, color: '#2D2A26' }}>{w.wins}</span>
                </div>
              ))}
            </div>
          )}

          {/* Daily friction */}
          {data.dailyFriction.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Friction</div>
              {data.dailyFriction.map(f => (
                <div key={f.date} style={{ padding: '4px 0', borderBottom: '1px solid #F5F3EF' }}>
                  <span style={{ fontSize: 10, color: '#B5B0A8' }}>{new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })} </span>
                  <span style={{ fontSize: 13, color: '#2D2A26' }}>{f.friction}</span>
                </div>
              ))}
            </div>
          )}

          {/* Weekly reflection */}
          <div style={{ background: '#FFF', border: '1px solid #F0EDE8', borderRadius: 10, padding: '16px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Weekly Reflection</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#8A857D', display: 'block', marginBottom: 4 }}>What worked this week?</label>
              <textarea
                value={whatWorked}
                onChange={e => setWhatWorked(e.target.value)}
                onBlur={saveReflection}
                rows={2}
                style={{ width: '100%', fontSize: 13, border: '1px solid #E8E4DC', borderRadius: 6, padding: '8px 10px', background: '#FAFAF7', color: '#2D2A26', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#8A857D', display: 'block', marginBottom: 4 }}>What do you want to change?</label>
              <textarea
                value={whatToChange}
                onChange={e => setWhatToChange(e.target.value)}
                onBlur={saveReflection}
                rows={2}
                style={{ width: '100%', fontSize: 13, border: '1px solid #E8E4DC', borderRadius: 6, padding: '8px 10px', background: '#FAFAF7', color: '#2D2A26', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#8A857D', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveReflection}
                rows={2}
                style={{ width: '100%', fontSize: 13, border: '1px solid #E8E4DC', borderRadius: 6, padding: '8px 10px', background: '#FAFAF7', color: '#2D2A26', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
