'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserValue } from '@/lib/types'
import ValueTagger from '@/components/shared/ValueTagger'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function friendlyDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtTime(t: string) {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr)
  const m = mStr ?? '00'
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${m}${ampm}`
}

const MOOD_OPTIONS = [
  { value: 1, label: 'Drained', color: '#C4504A' },
  { value: 2, label: 'Tough', color: '#D4885A' },
  { value: 3, label: 'Okay', color: '#B5B0A8' },
  { value: 4, label: 'Good', color: '#6BA07A' },
  { value: 5, label: 'Great', color: '#4A8B5E' },
]

interface ActionItemLocal {
  id: string
  name: string
  status: string
  scheduled_time: string | null
  activity_id: string | null
  committed_date: string | null
  completed_date: string | null
}

interface ActionLogEntry {
  id: string
  event_type: string
  action_item_id: string | null
  activity_id: string | null
  value_ids: string[] | null
  note: string | null
  metadata?: { cleanedName?: string; feelings?: string[] } | null
}

interface Props {
  displayName: string
}

export default function DayCompletionPage({ displayName }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const today = localDateStr(new Date())
  const yesterday = localDateStr(new Date(Date.now() - 86400000))
  const [date, setDate] = useState(dateParam ?? yesterday)
  const isStale = (() => {
    const diff = (new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 86400000
    return diff >= 3
  })()

  const [items, setItems] = useState<ActionItemLocal[]>([])
  const [logs, setLogs] = useState<ActionLogEntry[]>([])
  const [loggedEntries, setLoggedEntries] = useState<ActionLogEntry[]>([])
  const [values, setValues] = useState<UserValue[]>([])
  const [valueTags, setValueTags] = useState<Record<string, string[]>>({}) // logId -> value_ids
  const [mood, setMood] = useState<number | null>(null)
  const [wins, setWins] = useState('')
  const [friction, setFriction] = useState('')
  const [journal, setJournal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setCompleted(false)
    setAlreadyCompleted(false)
    const [todayRes, logsRes, loggedRes, valuesRes, dcRes] = await Promise.all([
      fetch(`/api/today?date=${date}&mode=pinned`),
      fetch(`/api/action-log?date=${date}&event_type=completed`),
      fetch(`/api/action-log?date=${date}&event_type=logged`),
      fetch('/api/values'),
      fetch(`/api/day-completion?date=${date}`),
    ])
    const todayData = await todayRes.json()
    const logsData = await logsRes.json()
    const loggedData = await loggedRes.json()
    const valuesData = await valuesRes.json()
    const dcData = await dcRes.json()

    setItems(todayData.items ?? [])
    setLogs(Array.isArray(logsData) ? logsData : [])
    setLoggedEntries(Array.isArray(loggedData) ? loggedData : [])
    setValues(Array.isArray(valuesData) ? valuesData : [])

    // Pre-fill value tags from existing log entries (both completed and logged)
    const tags: Record<string, string[]> = {}
    const allLogs = [...(Array.isArray(logsData) ? logsData : []), ...(Array.isArray(loggedData) ? loggedData : [])]
    for (const log of allLogs) {
      if (log.value_ids) tags[log.id] = log.value_ids
    }
    setValueTags(tags)

    // If day already completed, pre-fill
    if (dcData && dcData.id) {
      setAlreadyCompleted(true)
      setMood(dcData.mood)
      setWins(dcData.wins ?? '')
      setFriction(dcData.friction ?? '')
      setJournal(dcData.journal ?? '')
    } else {
      setMood(null)
      setWins('')
      setFriction('')
      setJournal('')
    }

    setLoading(false)
  }, [date])

  useEffect(() => { loadData() }, [loadData])

  // Items grouped by status
  const completedItems = items.filter(i => i.status === 'completed')
  const skippedItems = items.filter(i => i.status === 'skipped')
  // Incomplete scheduled items (committed for this date with a time) — can be completed from here
  const incompleteScheduled = items.filter(i => i.status !== 'completed' && i.status !== 'skipped' && i.scheduled_time && i.committed_date === date)
  // Unscheduled/rolled items — informational only
  const otherItems = items.filter(i => i.status !== 'completed' && i.status !== 'skipped' && !(i.scheduled_time && i.committed_date === date))

  // Find action_log entry for a completed action_item
  function logForItem(itemId: string) {
    return logs.find(l => l.action_item_id === itemId)
  }

  // Does this completed item need value tagging?
  function needsValueTag(item: ActionItemLocal) {
    if (item.activity_id) return false // Activity provides value links
    const log = logForItem(item.id)
    return !!log // Has a completion log entry we can tag
  }

  async function handleMarkComplete(itemId: string) {
    await fetch(`/api/action-items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', view_date: date }),
    })
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'completed' as const, completed_date: date } : i))
  }

  async function handleMarkSkipped(itemId: string) {
    await fetch(`/api/action-items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'skipped', view_date: date }),
    })
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'skipped' as const } : i))
  }

  async function handleValueTagChange(logId: string, valueIds: string[]) {
    setValueTags(prev => ({ ...prev, [logId]: valueIds }))
  }

  async function handleComplete() {
    setSaving(true)

    // Save value tags on action_log entries
    const tagPromises = Object.entries(valueTags).map(([logId, vIds]) =>
      fetch('/api/action-log', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: logId, value_ids: vIds.length > 0 ? vIds : null }),
      })
    )

    // Save day completion
    const dcPromise = fetch('/api/day-completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completion_date: date,
        mood,
        wins: wins.trim() || null,
        friction: friction.trim() || null,
        journal: journal.trim() || null,
      }),
    })

    await Promise.all([...tagPromises, dcPromise])
    setSaving(false)
    setCompleted(true)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = { marginBottom: 28 }
  const headingStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8A857D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }
  const textareaStyle: React.CSSProperties = {
    width: '100%', fontSize: 14, border: '1px solid #E8E4DC', borderRadius: 10,
    padding: '10px 14px', background: '#FFF', color: '#2D2A26',
    fontFamily: FONT, outline: 'none', boxSizing: 'border-box', resize: 'vertical',
  }

  if (loading) {
    return (
      <div style={{ fontFamily: FONT, display: 'flex', justifyContent: 'center', padding: 60, color: '#B5B0A8' }}>
        Loading...
      </div>
    )
  }

  // ── Completion confirmation screen ──────────────────────────────────────────
  if (completed) {
    const firstName = displayName.split(' ')[0]
    const messages = [
      `Nice work, ${firstName}. Another day lived with intention.`,
      `Day closed, ${firstName}. Rest well.`,
      `That's a wrap. You showed up today, ${firstName}.`,
      `${firstName}, you did good today. Let it settle.`,
      `Day complete. Tomorrow's a fresh page, ${firstName}.`,
    ]
    const message = messages[Math.floor(Math.random() * messages.length)]

    return (
      <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>✦</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#2D2A26', lineHeight: 1.4, marginBottom: 16 }}>
          {message}
        </div>
        <div style={{ fontSize: 14, color: '#8A8578', marginBottom: 40 }}>
          {friendlyDate(date)}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/today')}
            style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid #E8E4DC',
              background: '#FFF', color: '#2D2A26', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >Back to Today</button>
          <button
            onClick={() => router.push('/map')}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: '#C4725A', color: '#FFF', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >View Map</button>
        </div>
      </div>
    )
  }

  // ── Main completion form ────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, maxWidth: 520, margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/today')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#8A8578', fontFamily: FONT, padding: 0, marginBottom: 8 }}
        >← Back to Today</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#2D2A26' }}>
          {isStale ? 'Close Your Day' : 'Close Your Day'}
        </div>
        <div style={{ fontSize: 14, color: '#8A8578', marginTop: 4 }}>
          {friendlyDate(date)}
          {alreadyCompleted && <span style={{ marginLeft: 8, color: '#5A9E6F', fontSize: 11 }}>— already reviewed, editing</span>}
        </div>
      </div>

      {/* Day in Review */}
      <div style={sectionStyle}>
        <div style={headingStyle}>What You Did</div>
        {completedItems.length === 0 && skippedItems.length === 0 && otherItems.length === 0 && (
          <div style={{ fontSize: 13, color: '#B5B0A8', padding: '8px 0' }}>No items scheduled for this day.</div>
        )}
        {completedItems.map(item => {
          const log = logForItem(item.id)
          const showTagger = needsValueTag(item)
          return (
            <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #F8F7F4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#5A9E6F', fontSize: 13 }}>✓</span>
                <span style={{ fontSize: 14, color: '#2D2A26' }}>
                  {item.scheduled_time && <span style={{ color: '#8A8578', marginRight: 6 }}>{fmtTime(item.scheduled_time)}</span>}
                  {item.name}
                </span>
                {item.activity_id && <span style={{ fontSize: 9, color: '#B5B0A8', marginLeft: 'auto' }}>auto-linked</span>}
              </div>
              {showTagger && log && (
                <div style={{ marginTop: 6, marginLeft: 21 }}>
                  <div style={{ fontSize: 10, color: '#8A8578', marginBottom: 4 }}>What values did this serve?</div>
                  <ValueTagger
                    values={values}
                    selected={valueTags[log.id] ?? []}
                    onChange={(ids) => handleValueTagChange(log.id, ids)}
                    compact
                  />
                </div>
              )}
            </div>
          )
        })}
        {skippedItems.map(item => (
          <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #F8F7F4', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#B5B0A8', fontSize: 13 }}>—</span>
            <span style={{ fontSize: 14, color: '#B5B0A8', textDecoration: 'line-through' }}>
              {item.name}
            </span>
            <span style={{ fontSize: 9, color: '#B5B0A8', marginLeft: 'auto' }}>skipped</span>
          </div>
        ))}
        {/* Incomplete scheduled items — can be completed or skipped from here */}
        {incompleteScheduled.map(item => (
          <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #F8F7F4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => handleMarkComplete(item.id)}
                title="I did it"
                style={{ background: 'none', border: '1.5px solid #B5B0A8', borderRadius: 2, cursor: 'pointer', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: 'transparent', padding: 0 }}
              > </button>
              <span style={{ fontSize: 14, color: '#2D2A26' }}>
                {item.scheduled_time && <span style={{ color: '#8A8578', marginRight: 6 }}>{fmtTime(item.scheduled_time)}</span>}
                {item.name}
              </span>
              <button
                onClick={() => handleMarkSkipped(item.id)}
                title="Didn't happen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#B5B0A8', marginLeft: 'auto', flexShrink: 0, fontFamily: 'inherit' }}
              >✕ skip</button>
            </div>
          </div>
        ))}
        {/* Unscheduled / rolled items — informational only */}
        {otherItems.map(item => (
          <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #F8F7F4', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#B5B0A8', fontSize: 11 }}>○</span>
            <span style={{ fontSize: 14, color: '#B5B0A8' }}>
              {item.name}
            </span>
            <span style={{ fontSize: 9, color: '#B5B0A8', marginLeft: 'auto' }}>rolled to today</span>
          </div>
        ))}
      </div>

      {/* Logged captures — things the user recorded via capture but weren't scheduled */}
      {loggedEntries.length > 0 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Things You Logged</div>
          {loggedEntries.map(entry => {
            const displayName = entry.metadata?.cleanedName ?? entry.note ?? 'Logged entry'
            const feelings = entry.metadata?.feelings
            return (
              <div key={entry.id} style={{ padding: '8px 0', borderBottom: '1px solid #F8F7F4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#4B82AF', fontSize: 12 }}>◆</span>
                  <span style={{ fontSize: 14, color: '#2D2A26' }}>{displayName}</span>
                </div>
                {feelings && feelings.length > 0 && (
                  <div style={{ marginTop: 3, marginLeft: 21, fontSize: 11, color: '#8A8578' }}>
                    Felt: {feelings.join(', ')}
                  </div>
                )}
                <div style={{ marginTop: 6, marginLeft: 21 }}>
                  <div style={{ fontSize: 10, color: '#8A8578', marginBottom: 4 }}>What values did this serve?</div>
                  <ValueTagger
                    values={values}
                    selected={valueTags[entry.id] ?? []}
                    onChange={(ids) => handleValueTagChange(entry.id, ids)}
                    compact
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mood */}
      <div style={sectionStyle}>
        <div style={headingStyle}>{isStale ? 'Looking back, how was this day?' : 'How do you feel about today?'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MOOD_OPTIONS.map(m => (
            <button
              key={m.value}
              onClick={() => setMood(mood === m.value ? null : m.value)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 10,
                border: `1.5px solid ${mood === m.value ? m.color : '#E8E4DC'}`,
                background: mood === m.value ? m.color + '12' : '#FFF',
                color: mood === m.value ? m.color : '#8A8578',
                fontSize: 12, fontWeight: mood === m.value ? 700 : 500,
                cursor: 'pointer', fontFamily: FONT, textAlign: 'center',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wins & Friction */}
      {!isStale && (
        <>
          <div style={sectionStyle}>
            <div style={headingStyle}>What went well?</div>
            <textarea
              style={{ ...textareaStyle, minHeight: 60 }}
              value={wins}
              onChange={e => setWins(e.target.value)}
              placeholder="Wins, highlights, things that clicked..."
            />
          </div>

          <div style={sectionStyle}>
            <div style={headingStyle}>What was hard?</div>
            <textarea
              style={{ ...textareaStyle, minHeight: 60 }}
              value={friction}
              onChange={e => setFriction(e.target.value)}
              placeholder="Friction, blocks, things to adjust..."
            />
          </div>
        </>
      )}

      {/* Journal */}
      <div style={sectionStyle}>
        <div style={headingStyle}>{isStale ? 'Any notes on this day?' : 'Journal'}</div>
        <textarea
          style={{ ...textareaStyle, minHeight: isStale ? 60 : 100 }}
          value={journal}
          onChange={e => setJournal(e.target.value)}
          placeholder={isStale ? 'Optional — anything you remember...' : 'Anything on your mind...'}
        />
      </div>

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={saving}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          background: saving ? '#B5B0A8' : '#C4725A', color: '#FFF',
          fontSize: 16, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          fontFamily: FONT, marginBottom: 16,
        }}
      >
        {saving ? 'Saving...' : alreadyCompleted ? 'Update Day Review' : 'Complete This Day'}
      </button>

      {isStale && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#B5B0A8' }}>
          Quick close — mood and value tags are all that matter for older days.
        </div>
      )}
    </div>
  )
}
