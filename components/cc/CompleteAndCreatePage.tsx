'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

function getMondayOf(d: Date): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(monday.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

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
  return `Week of ${fmt(start)} → ${fmt(end)}`
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

export default function CompleteAndCreatePage() {
  const params = useParams()
  const router = useRouter()
  const weekStart = params.week_start as string
  const prevWeek = addWeeks(weekStart, -1)
  const nextWeek = addWeeks(weekStart, 1)

  const [thisWeek, setThisWeek] = useState<WeekRecord | null>(null)
  const [prevWeekRecord, setPrevWeekRecord] = useState<WeekRecord | null>(null)
  const [captures, setCaptures] = useState<CaptureEntry[]>([])
  const [nextWeekItems, setNextWeekItems] = useState<CaptureEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [completeText, setCompleteText] = useState('')
  const [createText, setCreateText] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const NC = { cache: 'no-store' } as const
    const [thisRes, prevRes, capsRes, nextItemsRes] = await Promise.all([
      fetch(`/api/weeks/${weekStart}`, NC),
      fetch(`/api/weeks/${prevWeek}`, NC),
      fetch(`/api/weeks/${prevWeek}/captures`, NC),
      fetch(`/api/weeks/${weekStart}/captures`, NC),
    ])
    const thisData = await thisRes.json()
    const prevData = await prevRes.json()
    const capsData = await capsRes.json()
    const nextData = await nextItemsRes.json()

    setThisWeek(thisData?.id ? thisData : null)
    setPrevWeekRecord(prevData?.id ? prevData : null)
    setCaptures(Array.isArray(capsData) ? capsData : [])
    setNextWeekItems(Array.isArray(nextData) ? nextData : [])
    setCompleteText(prevData?.complete_statement ?? '')
    setCreateText(thisData?.create_statement ?? '')
    setLoading(false)
  }, [weekStart, prevWeek])

  useEffect(() => { loadData() }, [loadData])

  // Debounced auto-save
  function autoSave(field: 'complete_statement' | 'create_statement', value: string, targetWeek: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
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

  async function toggleCheckbox(field: 'completed_at_ritual' | 'created_at_ritual' | 'organized_at' | 'deconflicted_at') {
    const target = field === 'completed_at_ritual' ? prevWeek : weekStart
    const record = field === 'completed_at_ritual' ? prevWeekRecord : thisWeek
    const currentValue = record ? (record as unknown as Record<string, unknown>)[field] : null
    const newValue = currentValue ? null : new Date().toISOString()
    await fetch(`/api/weeks/${target}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newValue }),
    })
    // Reload
    const res = await fetch(`/api/weeks/${target}`, { cache: 'no-store' })
    const data = await res.json()
    if (field === 'completed_at_ritual') setPrevWeekRecord(data)
    else setThisWeek(data)
  }

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: 14, height: 14, border: `1.5px solid ${checked ? '#5A9E6F' : '#C4BFB4'}`,
    borderRadius: 2, background: checked ? '#5A9E6F' : 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, fontSize: 9, color: '#FFF', marginRight: 4,
  })

  const isChecked = (field: string, record: WeekRecord | null) => !!(record as unknown as Record<string, unknown> | null)?.[field]

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  }

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* A. Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button onClick={() => router.push(`/cc/${addWeeks(weekStart, -1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>←</button>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, flex: 1 }}>Complete and Create</h1>
            <button onClick={() => router.push(`/cc/${addWeeks(weekStart, 1)}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A8578', fontFamily: FONT }}>→</button>
          </div>
          <div style={{ fontSize: 14, color: '#8A8578', marginBottom: 16 }}>{friendlyRange(weekStart)}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {([
              { field: 'completed_at_ritual', label: 'Completed', record: prevWeekRecord },
              { field: 'created_at_ritual', label: 'Created', record: thisWeek },
              { field: 'organized_at', label: 'Organized', record: thisWeek },
              { field: 'deconflicted_at', label: 'De-conflicted', record: thisWeek },
            ] as const).map(({ field, label, record }) => (
              <span key={field} onClick={() => toggleCheckbox(field)} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, color: isChecked(field, record) ? '#2D2A26' : '#B5B0A8' }}>
                <span style={checkboxStyle(isChecked(field, record))}>{isChecked(field, record) ? '✓' : ''}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* B. Last Week's Create Statement */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Last week&apos;s intent</div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: prevWeekRecord?.create_statement ? '#2D2A26' : '#B5B0A8', fontStyle: prevWeekRecord?.create_statement ? 'normal' : 'italic' }}>
            {prevWeekRecord?.create_statement ?? 'Routine week.'}
          </div>
        </div>

        {/* C. Captures Stream */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Last week, in your words</div>
          {captures.length === 0 ? (
            <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>No captures for last week.</div>
          ) : (
            <div>
              {captures.map((c, i) => (
                <CaptureEntry key={c.source_id + i} timestamp={c.timestamp} text={c.text} />
              ))}
            </div>
          )}
        </div>

        {/* D. Complete Last Week */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Complete last week</div>
            <span
              onClick={() => setShowHelp(showHelp === 'complete' ? null : 'complete')}
              style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}
            >?</span>
            {saved === 'complete_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
          </div>
          {showHelp === 'complete' && (
            <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
              Looking back at the week through your own words helps you notice patterns, surprises, and the gap between intent and reality. Reflection is the practice; this is the surface.
            </div>
          )}
          <div style={{ fontSize: 13, color: '#B5B0A8', marginBottom: 8, lineHeight: 1.5 }}>
            Was that what you expected? What did you feel and notice? What surprised you?
          </div>
          <textarea
            value={completeText}
            onChange={e => { setCompleteText(e.target.value); autoSave('complete_statement', e.target.value, prevWeek) }}
            onBlur={() => autoSave('complete_statement', completeText, prevWeek)}
            rows={4}
            style={{ width: '100%', fontSize: 15, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '12px 14px', background: '#FFFFFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
          />
        </div>

        {/* E. Preview of Next Week */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Next week, so far</div>
          {nextWeekItems.length === 0 ? (
            <div style={{ fontSize: 14, color: '#B5B0A8', fontStyle: 'italic' }}>Nothing on the books yet.</div>
          ) : (
            <div>
              {nextWeekItems.map((c, i) => (
                <CaptureEntry key={c.source_id + i} timestamp={c.timestamp} text={c.text} />
              ))}
            </div>
          )}
        </div>

        {/* F. Create This Week */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>Create this week</div>
            <span
              onClick={() => setShowHelp(showHelp === 'create' ? null : 'create')}
              style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #C4BFB4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8A857D', cursor: 'pointer' }}
            >?</span>
            {saved === 'create_statement' && <span style={{ fontSize: 10, color: '#5A9E6F' }}>saved</span>}
          </div>
          {showHelp === 'create' && (
            <div style={{ fontSize: 12, color: '#8A857D', background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
              Setting intent for the week — not as a plan, but as a statement of expectation — gives next Sunday&apos;s reflection something to compare against. Intent isn&apos;t a commitment to control the week; it&apos;s a clear-eyed statement of what you expect and intend.
            </div>
          )}
          <div style={{ fontSize: 13, color: '#B5B0A8', marginBottom: 8, lineHeight: 1.5 }}>
            What do you expect and intend for this coming week? What might be hard? What might be wonderful?
          </div>
          <textarea
            value={createText}
            onChange={e => { setCreateText(e.target.value); autoSave('create_statement', e.target.value, weekStart) }}
            onBlur={() => autoSave('create_statement', createText, weekStart)}
            rows={4}
            style={{ width: '100%', fontSize: 15, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '12px 14px', background: '#FFFFFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
          />
        </div>

        {/* G. Footer Links */}
        <div style={{ display: 'flex', gap: 16 }}>
          <a href="/organize" style={{ fontSize: 12, color: '#8A8578', textDecoration: 'none' }}>Organize this week →</a>
        </div>
      </div>
    </div>
  )
}

// Truncatable capture entry — 5 lines max, expand/collapse toggle
const LINE_HEIGHT = 1.6
const MAX_LINES = 5
const MAX_HEIGHT = `calc(${MAX_LINES} * ${LINE_HEIGHT}em)`

function CaptureEntry({ timestamp, text }: { timestamp: string; text: string }) {
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
