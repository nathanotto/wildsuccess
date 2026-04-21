'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

const FONT = '"Source Sans 3", "Source Sans Pro", sans-serif'

interface Summary {
  mission: {
    name: string
    description: string | null
    status: string
    closure_type: string | null
    closure_note: string | null
    closed_at: string | null
    big_outcome_id: string | null
    created_at: string
  }
  collaborators: Array<{ name: string; role: string; status: string }>
  factors: {
    total: number
    byType: { driver: number; constraint: number; fact: number; assumption: number }
    active: number; resolved: number; invalidated: number
  }
  coas: {
    total: number
    byStatus: { proposed: number; committed: number; completed: number; abandoned: number }
  }
  commitments: { total: number; active: number; completed: number; abandoned: number }
  log: { total: number; milestones: Array<{ description: string; date: string }> }
  duration: { started: string; days: number }
}

const CLOSURE_TYPES = [
  { value: 'accomplished', label: 'Accomplished', description: 'The mission achieved what it set out to do', color: '#5A9E6F' },
  { value: 'partially_accomplished', label: 'Partially accomplished', description: 'Some objectives met, some not', color: '#4B82AF' },
  { value: 'shelved', label: 'Shelved', description: 'Paused indefinitely, may return to it', color: '#8A857D' },
  { value: 'superseded', label: 'Superseded', description: 'Replaced by a different approach or mission', color: '#C4725A' },
  { value: 'abandoned', label: 'Abandoned', description: 'Decided not to pursue', color: '#C4504A' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function MissionClosurePage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.missionId as string

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [closureType, setClosureType] = useState<string | null>(null)
  const [closureNote, setClosureNote] = useState('')
  const [closing, setClosing] = useState(false)
  const [closed, setClosed] = useState(false)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/missions/${missionId}/close`)
    if (res.ok) {
      const data = await res.json()
      setSummary(data)
      if (data.mission.closure_type) {
        setClosureType(data.mission.closure_type)
        setClosureNote(data.mission.closure_note ?? '')
        setClosed(true)
      }
    }
    setLoading(false)
  }, [missionId])

  useEffect(() => { loadSummary() }, [loadSummary])

  async function handleClose() {
    if (!closureType) return
    setClosing(true)
    const res = await fetch(`/api/missions/${missionId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closure_type: closureType, closure_note: closureNote }),
    })
    if (res.ok) setClosed(true)
    setClosing(false)
  }

  if (loading || !summary) {
    return <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  }

  const s = summary
  const isClosed = closed || !!s.mission.closed_at
  const selectedType = CLOSURE_TYPES.find(t => t.value === closureType)

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      <style>{`
        .closure-panels { display: flex; gap: 40px; }
        .closure-left { flex: 1; min-width: 0; }
        .closure-right { width: 360px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .closure-panels { flex-direction: column; gap: 24px; }
          .closure-right { width: 100%; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => router.push(`/plan/${missionId}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#8A8578', fontFamily: FONT, padding: 0, marginBottom: 8 }}>
            ← Back to mission
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            {isClosed ? 'Mission Closed' : 'Close Mission'}
          </h1>
          <div style={{ fontSize: 15, color: '#8A8578' }}>{s.mission.name}</div>
          {s.mission.description && (
            <div style={{ fontSize: 13, color: '#B5B0A8', marginTop: 4, lineHeight: 1.5 }}>{s.mission.description}</div>
          )}
        </div>

        <div className="closure-panels">
          {/* ── Left: Summary ──────────────────────────────────────────── */}
          <div className="closure-left">
            {/* Duration */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Duration</div>
              <div style={{ fontSize: 14 }}>
                {fmtDate(s.duration.started)} — {isClosed && s.mission.closed_at ? fmtDate(s.mission.closed_at) : 'present'}
                <span style={{ color: '#8A8578', marginLeft: 8 }}>{s.duration.days} days</span>
              </div>
            </div>

            {/* Collaborators */}
            {s.collaborators.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Collaborators</div>
                {s.collaborators.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
                    {c.name} <span style={{ color: '#8A8578' }}>· {c.role}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Factors */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Factors</div>
              <div style={{ fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>{s.factors.total} total</span>
                {s.factors.byType.driver > 0 && <span style={{ color: '#5A9E6F' }}>{s.factors.byType.driver} drivers</span>}
                {s.factors.byType.constraint > 0 && <span style={{ color: '#C4504A' }}>{s.factors.byType.constraint} constraints</span>}
                {s.factors.byType.fact > 0 && <span style={{ color: '#4B82AF' }}>{s.factors.byType.fact} facts</span>}
                {s.factors.byType.assumption > 0 && <span style={{ color: '#C4725A' }}>{s.factors.byType.assumption} assumptions</span>}
              </div>
              <div style={{ fontSize: 12, color: '#8A8578', marginTop: 4 }}>
                {s.factors.resolved} resolved · {s.factors.active} active · {s.factors.invalidated} invalidated
              </div>
            </div>

            {/* Courses of Action */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Courses of Action</div>
              <div style={{ fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>{s.coas.total} total</span>
                {s.coas.byStatus.committed > 0 && <span style={{ color: '#5A9E6F' }}>{s.coas.byStatus.committed} committed</span>}
                {s.coas.byStatus.completed > 0 && <span style={{ color: '#5A9E6F' }}>{s.coas.byStatus.completed} completed</span>}
                {s.coas.byStatus.proposed > 0 && <span style={{ color: '#8A8578' }}>{s.coas.byStatus.proposed} proposed</span>}
                {s.coas.byStatus.abandoned > 0 && <span style={{ color: '#C4504A' }}>{s.coas.byStatus.abandoned} abandoned</span>}
              </div>
            </div>

            {/* Commitments */}
            {s.commitments.total > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Commitments</div>
                <div style={{ fontSize: 13, display: 'flex', gap: 16 }}>
                  <span>{s.commitments.total} total</span>
                  <span style={{ color: '#5A9E6F' }}>{s.commitments.completed} completed</span>
                  {s.commitments.active > 0 && <span style={{ color: '#C4725A' }}>{s.commitments.active} still active</span>}
                  {s.commitments.abandoned > 0 && <span style={{ color: '#C4504A' }}>{s.commitments.abandoned} abandoned</span>}
                </div>
              </div>
            )}

            {/* Milestones */}
            {s.log.milestones.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Key Milestones</div>
                {s.log.milestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontSize: 10, color: '#B5B0A8', width: 70, flexShrink: 0, paddingTop: 2 }}>
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span>{m.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Closure ─────────────────────────────────────────── */}
          <div className="closure-right">
            {/* Already closed banner */}
            {isClosed && s.mission.closed_at && (
              <div style={{ marginBottom: 20, padding: '10px 14px', background: '#F4FDF7', border: '1px solid #5A9E6F40', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#5A9E6F', marginBottom: 4 }}>
                  Mission closed
                </div>
                <div style={{ fontSize: 12, color: '#8A8578' }}>
                  {fmtDate(s.mission.closed_at)}
                  {selectedType && ` · ${selectedType.label}`}
                </div>
              </div>
            )}

            {/* Outcome assessment */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Outcome</div>
              {CLOSURE_TYPES.map(ct => (
                <label key={ct.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: isClosed ? 'default' : 'pointer',
                  opacity: isClosed && closureType !== ct.value ? 0.3 : 1,
                }}>
                  <input
                    type="radio"
                    name="closure_type"
                    value={ct.value}
                    checked={closureType === ct.value}
                    onChange={() => !isClosed && setClosureType(ct.value)}
                    disabled={isClosed}
                    style={{ marginTop: 3, accentColor: ct.color }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ct.color }}>{ct.label}</div>
                    <div style={{ fontSize: 11, color: '#8A8578' }}>{ct.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Reflection */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Closing Reflection</div>
              {!isClosed && (
                <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 6, lineHeight: 1.5 }}>
                  What did you learn? What would you do differently? What was the real outcome?
                </div>
              )}
              {isClosed ? (
                <div style={{ fontSize: 14, lineHeight: 1.6, color: closureNote ? '#2D2A26' : '#B5B0A8', fontStyle: closureNote ? 'normal' : 'italic' }}>
                  {closureNote || 'No reflection written.'}
                </div>
              ) : (
                <textarea
                  value={closureNote}
                  onChange={e => setClosureNote(e.target.value)}
                  rows={5}
                  style={{ width: '100%', fontSize: 14, lineHeight: 1.6, border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 12px', background: '#FFF', color: '#2D2A26', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Close button */}
            {!isClosed && (
              <button
                onClick={handleClose}
                disabled={!closureType || closing}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: closureType ? (selectedType?.color ?? '#8A857D') : '#E8E4DC',
                  color: closureType ? '#FFF' : '#B5B0A8',
                  fontSize: 14, fontWeight: 600,
                  cursor: closureType ? 'pointer' : 'default',
                  fontFamily: FONT, marginBottom: 12,
                }}
              >
                {closing ? 'Closing…' : 'Close this mission'}
              </button>
            )}

            {isClosed && (
              <div style={{ marginTop: 8 }}>
                <span onClick={() => router.push(`/plan/${missionId}`)} style={{ fontSize: 12, color: '#8A8578', cursor: 'pointer' }}>
                  ← Back to mission overview
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
