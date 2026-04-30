'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ReviewSubNav from './ReviewSubNav'
import { COLORS } from '@/lib/theme'

const FONT = "'Source Sans 3', 'Source Sans Pro', sans-serif"

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function friendlyDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtCompletionTime(isoStr: string | null) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${m}${ampm}`
}

function fmtLogTime(isoStr: string) {
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${m}${ampm}`
}

// ── Mood config ──────────────────────────────────────────────────────────────

const MOOD_MAP: Record<number, { label: string; color: string }> = {
  5: { label: 'Great', color: '#5A9E6F' },
  4: { label: 'Good', color: '#5A9E6F' },
  3: { label: 'Okay', color: '#BA7517' },
  2: { label: 'Tough', color: '#B8443E' },
  1: { label: 'Hard', color: '#B8443E' },
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ReviewItem {
  id: string
  name: string
  status: string
  scheduled_time: string | null
  completed_at: string | null
  sort_order: number
}

interface LogEntry {
  id: string
  note: string | null
  metadata: { cleanedName?: string } | null
  created_at: string
}

interface DayData {
  completed: ReviewItem[]
  incomplete: ReviewItem[]
  logged: LogEntry[]
  reflection: {
    mood_energy: number | null
    journal_note: string | null
    wins: string | null
    friction: string | null
    plan_status: string
  }
  metadata: {
    date: string
    dayOfWeek: string
    daysAgo: number
    daysAgoLabel: string
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  displayName: string
}

export default function ReviewDaysPage({ displayName }: Props) {
  const router = useRouter()
  const todayStr = toDateStr(new Date())
  const yesterdayStr = addDays(todayStr, -1)

  const [currentDate, setCurrentDate] = useState(yesterdayStr)
  const [dayData, setDayData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [animating, setAnimating] = useState(false)

  // Cache for prefetched days
  const cache = useRef<Record<string, DayData>>({})

  // Swipe tracking
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchDay = useCallback(async (date: string): Promise<DayData | null> => {
    if (cache.current[date]) return cache.current[date]
    try {
      const res = await fetch(`/api/review/day?date=${date}`)
      if (!res.ok) return null
      const data = await res.json()
      cache.current[date] = data
      return data
    } catch {
      return null
    }
  }, [])

  const loadDay = useCallback(async (date: string) => {
    setLoading(true)
    const data = await fetchDay(date)
    setDayData(data)
    setLoading(false)

    // Prefetch adjacent days
    const prev = addDays(date, -1)
    const next = addDays(date, 1)
    fetchDay(prev)
    if (next <= todayStr) fetchDay(next)
  }, [fetchDay, todayStr])

  useEffect(() => {
    loadDay(currentDate)
  }, [currentDate, loadDay])

  const canGoNext = currentDate < todayStr
  const isAtToday = currentDate >= todayStr

  function navigateTo(date: string, direction: 'left' | 'right') {
    if (animating) return
    setSlideDir(direction)
    setAnimating(true)
    setTimeout(() => {
      setCurrentDate(date)
      setSlideDir(null)
      setAnimating(false)
    }, 300)
  }

  function goPrev() {
    navigateTo(addDays(currentDate, -1), 'right')
  }

  function goNext() {
    if (!canGoNext) return
    navigateTo(addDays(currentDate, 1), 'left')
  }

  // Swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
    if (dx < 0) goNext()   // swipe left = next day
    else goPrev()           // swipe right = previous day
  }

  async function handleReopen() {
    const res = await fetch(`/api/review/day/reopen?date=${currentDate}`, { method: 'POST' })
    if (res.ok) {
      router.push(`/today?date=${currentDate}`)
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const sectionHead: React.CSSProperties = {
    fontSize: 11, color: '#B5B0A8', textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, marginTop: 20,
  }

  const slideStyle: React.CSSProperties = slideDir ? {
    animation: `slide-${slideDir} 300ms ease forwards`,
  } : {}

  // ── Render ──────────────────────────────────────────────────────────────────

  const ref = dayData?.reflection
  const mood = ref?.mood_energy ? MOOD_MAP[ref.mood_energy] : null
  const isClosed = ref?.plan_status === 'closed'
  const hasReflection = ref && (ref.wins || ref.friction || ref.journal_note)

  return (
    <div style={{ fontFamily: FONT, maxWidth: 480, padding: '0 20px', marginLeft: 40 }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes slide-left {
          0% { opacity: 1; transform: translateX(0); }
          40% { opacity: 0; transform: translateX(-40px); }
          41% { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-right {
          0% { opacity: 1; transform: translateX(0); }
          40% { opacity: 0; transform: translateX(40px); }
          41% { opacity: 0; transform: translateX(-40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <ReviewSubNav />

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 0 4px' }}>
        <button
          onClick={goPrev}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#8A8578', padding: '4px 12px',
          }}
        >
          &#8249;
        </button>
        <div style={{ textAlign: 'center', minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2D2A26' }}>
            {friendlyDate(currentDate)}
          </div>
          <div style={{ fontSize: 12, color: '#8A8578', marginTop: 2 }}>
            {dayData?.metadata?.daysAgoLabel ?? ''}
          </div>
        </div>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          style={{
            background: 'none', border: 'none',
            cursor: canGoNext ? 'pointer' : 'default',
            fontSize: 20, color: canGoNext ? '#8A8578' : '#E8E4DC',
            padding: '4px 12px',
          }}
        >
          &#8250;
        </button>
      </div>

      {/* Day content with swipe + animation */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ ...slideStyle, paddingBottom: 60, minHeight: 200 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#B5B0A8', fontSize: 14 }}>Loading...</div>
        ) : !dayData ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#B5B0A8', fontSize: 14 }}>No data for this day.</div>
        ) : (
          <>
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, marginTop: 8 }}>
              {isClosed ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#8A857D' }}>Day closed</span>
                  {mood && <span style={{ fontSize: 12, color: mood.color }}>{mood.label}</span>}
                </>
              ) : currentDate < todayStr ? (
                <a href={`/today/complete?date=${currentDate}`} style={{ fontSize: 13, color: COLORS.primary, textDecoration: 'none', cursor: 'pointer' }}>Close this day →</a>
              ) : (
                <span style={{ fontSize: 13, color: '#B5B0A8' }}>Today</span>
              )}
              <span style={{ flex: 1 }} />
              {isClosed && (
                <button
                  onClick={handleReopen}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#B5B0A8', padding: 0,
                  }}
                >
                  Reopen this day
                </button>
              )}
            </div>

            {/* Done section */}
            {dayData.completed.length > 0 && (
              <div>
                <div style={sectionHead}>Done</div>
                {dayData.completed.map(item => (
                  <div key={item.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 2, background: '#5A9E6F',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'white', fontSize: 10,
                    }}>&#10003;</span>
                    <span style={{ fontSize: 14, color: '#2D2A26', textDecoration: 'line-through', opacity: 0.4 }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#B5B0A8', marginLeft: 'auto' }}>
                      {fmtCompletionTime(item.completed_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Incomplete section */}
            {dayData.incomplete.length > 0 && (
              <div>
                <div style={sectionHead}>Incomplete</div>
                {dayData.incomplete.map(item => (
                  <div key={item.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 2, border: '1.5px solid #D0CBC3',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 14, color: '#2D2A26', opacity: 0.4 }}>
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Logged section */}
            {dayData.logged.length > 0 && (
              <div>
                <div style={sectionHead}>Logged</div>
                {dayData.logged.map(entry => (
                  <div key={entry.id} style={{ padding: '3px 0', display: 'flex', gap: 8, fontSize: 13 }}>
                    <span style={{ fontSize: 12, color: '#B5B0A8', flexShrink: 0, width: 44 }}>
                      {fmtLogTime(entry.created_at)}
                    </span>
                    <span style={{ color: '#8A8578' }}>
                      {entry.metadata?.cleanedName ?? entry.note}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Divider between data and reflection */}
            {hasReflection && (
              <div style={{
                height: 1, background: COLORS.primary, opacity: 0.2,
                marginTop: 12, marginBottom: 12,
              }} />
            )}

            {/* Wins */}
            {ref?.wins && (
              <div style={{ marginBottom: 12 }}>
                <div style={sectionHead}>Wins</div>
                <div style={{ fontSize: 14, color: '#2D2A26', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {ref.wins}
                </div>
              </div>
            )}

            {/* Friction */}
            {ref?.friction && (
              <div style={{ marginBottom: 12 }}>
                <div style={sectionHead}>Friction</div>
                <div style={{ fontSize: 14, color: '#2D2A26', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {ref.friction}
                </div>
              </div>
            )}

            {/* Journal */}
            {ref?.journal_note && (
              <div style={{ marginBottom: 12 }}>
                <div style={sectionHead}>Journal</div>
                <div style={{ fontSize: 14, color: '#2D2A26', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {ref.journal_note}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
