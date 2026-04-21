'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { COA, Factor, COADependency, COAResourceNeed, Mission } from '@/lib/types'
import { getAuthorColor } from '@/lib/author-colors'

const FONT = '"Source Sans 3", "Source Sans Pro", sans-serif'

const HORIZONS: { key: COA['time_horizon']; label: string; color: string }[] = [
  { key: 'unset', label: 'Unsorted', color: '#B5B0A8' },
  { key: 'now', label: 'Now', color: '#5A9E6F' },
  { key: 'next', label: 'Next', color: '#4B82AF' },
  { key: 'later', label: 'Later', color: '#9B7EC8' },
]

const RESOURCE_KINDS = ['time', 'money', 'people', 'materials', 'access', 'other'] as const

interface Props {
  missionId: string
}

export default function ArrangePage({ missionId }: Props) {
  const router = useRouter()
  const [mission, setMission] = useState<Mission | null>(null)
  const [coas, setCoas] = useState<COA[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [dependencies, setDependencies] = useState<COADependency[]>([])
  const [resources, setResources] = useState<Record<string, COAResourceNeed[]>>({})
  const [coaFactorLinks, setCoaFactorLinks] = useState<Record<string, { factor_id: string; relationship: string }[]>>({})
  const [loading, setLoading] = useState(true)

  // Active COA
  const [activeCoa, setActiveCoa] = useState<string | null>(null)

  // Thread state
  const [threadMessages, setThreadMessages] = useState<Array<{ id: string; user_id: string; description: string; created_at: string }>>([])
  const [threadInput, setThreadInput] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Kanban collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState<Set<string>>(new Set())

  // Interaction state
  const [linkingDepFrom, setLinkingDepFrom] = useState<string | null>(null)
  const [depModal, setDepModal] = useState<{ from: string; to: string } | null>(null)
  const [depReason, setDepReason] = useState('')
  const [depHard, setDepHard] = useState(false)
  const [addingResource, setAddingResource] = useState(false)
  const [resDesc, setResDesc] = useState('')
  const [resKind, setResKind] = useState<string>('other')
  const [resQty, setResQty] = useState('')
  const [resUnit, setResUnit] = useState('')
  const [editingOutcome, setEditingOutcome] = useState(false)
  const [outcomeText, setOutcomeText] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Factor review modal
  const [reviewModal, setReviewModal] = useState<{ coaId: string; coaAction: string; coaOutcome: string | null; factors: Factor[] } | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [reviewCreateFact, setReviewCreateFact] = useState<Record<string, boolean>>({})
  const [reviewFactText, setReviewFactText] = useState<Record<string, string>>({})

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
  }

  const loadData = useCallback(async () => {
    const [missions, coaData, factorData, depData] = await Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/coas`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/factors`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/coa-dependencies`).then(r => r.json()),
    ])
    const m = (Array.isArray(missions) ? missions : []).find((ms: Mission) => ms.id === missionId)
    setMission(m ?? null)
    const coaArr = Array.isArray(coaData) ? coaData : []
    setCoas(coaArr)
    setFactors(Array.isArray(factorData) ? factorData : [])
    setDependencies(Array.isArray(depData) ? depData : [])

    const [resMap, linkMap] = await Promise.all([
      Promise.all(coaArr.map(async (c: COA) => {
        const res = await fetch(`/api/missions/${missionId}/coas/${c.id}/resources`)
        return { id: c.id, data: await res.json() }
      })),
      Promise.all(coaArr.map(async (c: COA) => {
        const res = await fetch(`/api/missions/${missionId}/coas/${c.id}/factors`)
        return { id: c.id, data: await res.json() }
      })),
    ])

    const rm: Record<string, COAResourceNeed[]> = {}
    resMap.forEach(r => { rm[r.id] = Array.isArray(r.data) ? r.data : [] })
    setResources(rm)

    const lm: Record<string, { factor_id: string; relationship: string }[]> = {}
    linkMap.forEach(l => { lm[l.id] = Array.isArray(l.data) ? l.data : [] })
    setCoaFactorLinks(lm)

    // Auto-select first non-completed COA
    if (!activeCoa) {
      const first = coaArr.find((c: COA) => c.status !== 'completed')
      if (first) setActiveCoa(first.id)
      else if (coaArr.length > 0) setActiveCoa(coaArr[0].id)
    }

    setLoading(false)
  }, [missionId, activeCoa])

  useEffect(() => { loadData() }, [loadData])

  // Fetch current user and collaborator names
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.id) setCurrentUserId(data.id)
      if (data?.preferred_name || data?.display_name) {
        setUserNames(prev => ({ ...prev, [data.id]: data.preferred_name || data.display_name }))
      }
    })
    fetch(`/api/missions/${missionId}/commitments`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const names: Record<string, string> = {}
        data.forEach((c: { user_id: string; user_name?: string }) => {
          if (c.user_name) names[c.user_id] = c.user_name
        })
        setUserNames(prev => ({ ...prev, ...names }))
      }
    })
  }, [missionId])

  // Load thread when active COA changes
  const loadThread = useCallback(async (coaId: string) => {
    const res = await fetch(`/api/missions/${missionId}/log?subject_type=coa&subject_id=${coaId}`)
    if (res.ok) {
      const data = await res.json()
      setThreadMessages(Array.isArray(data) ? data.reverse() : []) // API returns desc, we want asc
    }
  }, [missionId])

  useEffect(() => {
    if (activeCoa) loadThread(activeCoa)
    else setThreadMessages([])
  }, [activeCoa, loadThread])

  // Scroll to bottom when messages change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  async function postThreadMessage() {
    if (!threadInput.trim() || !activeCoa) return
    const text = threadInput.trim()
    setThreadInput('')
    await fetch(`/api/missions/${missionId}/log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: text, subject_type: 'coa', subject_id: activeCoa }),
    })
    loadThread(activeCoa)
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function setTimeHorizon(coaId: string, horizon: COA['time_horizon']) {
    await fetch(`/api/missions/${missionId}/coas/${coaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_horizon: horizon }),
    })
    setCoas(prev => prev.map(c => c.id === coaId ? { ...c, time_horizon: horizon } : c))
  }

  async function createDependency() {
    if (!depModal || !depReason.trim()) return
    const res = await fetch(`/api/missions/${missionId}/coa-dependencies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coa_id: depModal.from, depends_on_coa_id: depModal.to, reason: depReason.trim(), is_hard: depHard }),
    })
    if (res.ok) { const dep = await res.json(); setDependencies(prev => [...prev, dep]); showToast('Dependency created') }
    setDepModal(null); setDepReason(''); setDepHard(false); setLinkingDepFrom(null)
  }

  async function deleteDependency(id: string) {
    const res = await fetch(`/api/missions/${missionId}/coa-dependencies/${id}`, { method: 'DELETE' })
    if (res.ok) setDependencies(prev => prev.filter(d => d.id !== id))
  }

  async function addResource() {
    if (!resDesc.trim() || !activeCoa) return
    const res = await fetch(`/api/missions/${missionId}/coas/${activeCoa}/resources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: resDesc.trim(), kind: resKind, quantity: resQty ? Number(resQty) : null, unit: resUnit || null }),
    })
    if (res.ok) { const r = await res.json(); setResources(prev => ({ ...prev, [activeCoa!]: [...(prev[activeCoa!] ?? []), r] })) }
    setAddingResource(false); setResDesc(''); setResKind('other'); setResQty(''); setResUnit('')
  }

  async function updateResourceStatus(coaId: string, resId: string, status: string) {
    await fetch(`/api/missions/${missionId}/coas/${coaId}/resources/${resId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setResources(prev => ({ ...prev, [coaId]: (prev[coaId] ?? []).map(r => r.id === resId ? { ...r, status: status as COAResourceNeed['status'] } : r) }))
  }

  async function saveOutcome(coaId: string) {
    await fetch(`/api/missions/${missionId}/coas/${coaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: outcomeText.trim() || null }),
    })
    setCoas(prev => prev.map(c => c.id === coaId ? { ...c, outcome: outcomeText.trim() || null } : c))
    setEditingOutcome(false)
  }

  async function markCoaCompleted(coaId: string) {
    const res = await fetch(`/api/missions/${missionId}/coas/${coaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (res.ok) {
      const data = await res.json()
      setCoas(prev => prev.map(c => c.id === coaId ? { ...c, status: 'completed' } : c))
      if (data.targeted_factors?.length) {
        const coa = coas.find(c => c.id === coaId)
        setReviewModal({ coaId, coaAction: coa?.action ?? '', coaOutcome: coa?.outcome ?? null, factors: data.targeted_factors })
      } else { showToast('COA completed') }
    }
  }

  async function resolveFactorFromReview(factorId: string, resolutionNote: string, createFact: boolean, factText: string) {
    await fetch(`/api/missions/${missionId}/factors/${factorId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolution_note: resolutionNote, resolved_by_coa_id: reviewModal?.coaId, create_fact: createFact, fact_text: factText }),
    })
    setFactors(prev => prev.map(f => f.id === factorId ? { ...f, status: 'resolved', resolution_note: resolutionNote } : f))
  }

  async function addNote() {
    if (!noteInput.trim()) return
    await fetch(`/api/missions/${missionId}/log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: noteInput.trim() }),
    })
    showToast('Note added'); setNoteInput('')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13, fontFamily: FONT }}>Loading…</div>

  const factorMap = new Map(factors.map(f => [f.id, f]))
  const accountedFactors = new Set<string>()
  Object.values(coaFactorLinks).forEach(links => links.forEach(l => accountedFactors.add(l.factor_id)))
  const pct = factors.length > 0 ? Math.round((accountedFactors.size / factors.length) * 100) : 0

  const active = coas.find(c => c.id === activeCoa) ?? null
  const activeRes = active ? (resources[active.id] ?? []) : []
  const activeDeps = active ? dependencies.filter(d => d.coa_id === active.id) : []
  const activeLinks = active ? (coaFactorLinks[active.id] ?? []) : []

  function toggleSection(key: string) {
    setCollapsedSections(prev => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s })
  }

  function toggleShowCompleted(key: string) {
    setShowCompleted(prev => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s })
  }

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>
      <style>{`
        .arrange-panels { display: flex; height: calc(100vh - 60px); }
        .arrange-kanban { width: 200px; flex-shrink: 0; border-right: 1px solid #E8E4DC; overflow-y: auto; background: #F7F5F0; }
        .arrange-workspace { flex: 1; overflow-y: auto; min-width: 0; }
        @media (max-width: 900px) {
        }
        @media (max-width: 600px) {
          .arrange-kanban { width: 160px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #E8E4DC', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: '#8A8578', cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>← Mission</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#C4725A' }}>{mission?.name ?? ''}</span>
        <span style={{ fontSize: 10, color: '#8A8578' }}>{accountedFactors.size}/{factors.length} factors ({pct}%)</span>
      </div>

      <div className="arrange-panels">
        {/* ── Left: Kanban ───────────────────────────────────────────────── */}
        <div className="arrange-kanban">
          {HORIZONS.map(h => {
            const sectionCoas = coas.filter(c => c.time_horizon === h.key).sort((a, b) => a.sort_order - b.sort_order)
            const activeCoas = sectionCoas.filter(c => c.status !== 'completed')
            const completedCoas = sectionCoas.filter(c => c.status === 'completed')
            const isCollapsed = collapsedSections.has(h.key)
            const showingCompleted = showCompleted.has(h.key)

            return (
              <div key={h.key} style={{ padding: '8px 8px 4px' }}>
                <div
                  onClick={() => toggleSection(h.key)}
                  style={{ fontSize: 10, fontWeight: 700, color: h.color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}
                >
                  <span style={{ fontSize: 8 }}>{isCollapsed ? '▶' : '▼'}</span>
                  {h.label}
                  <span style={{ fontWeight: 400, color: '#8A8578' }}>({sectionCoas.length})</span>
                </div>

                {!isCollapsed && (
                  <>
                    {activeCoas.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (linkingDepFrom && linkingDepFrom !== c.id) {
                            setDepModal({ from: linkingDepFrom, to: c.id })
                            setLinkingDepFrom(null)
                          } else {
                            setActiveCoa(c.id)
                          }
                        }}
                        style={{
                          padding: '4px 8px', marginBottom: 2, borderRadius: 4, cursor: 'pointer',
                          background: activeCoa === c.id ? '#FFF' : 'transparent',
                          border: activeCoa === c.id ? `1px solid ${h.color}60` : '1px solid transparent',
                          fontSize: 11, color: '#2D2A26',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {c.status === 'committed' && <span style={{ color: '#C4725A', marginRight: 3 }}>●</span>}
                        {c.action}
                      </div>
                    ))}
                    {completedCoas.length > 0 && (
                      <div
                        onClick={() => toggleShowCompleted(h.key)}
                        style={{ fontSize: 9, color: '#5A9E6F', cursor: 'pointer', padding: '2px 8px' }}
                      >
                        ✓ {completedCoas.length} completed {showingCompleted ? '▴' : '▾'}
                      </div>
                    )}
                    {showingCompleted && completedCoas.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setActiveCoa(c.id)}
                        style={{
                          padding: '4px 8px', marginBottom: 2, borderRadius: 4, cursor: 'pointer',
                          background: activeCoa === c.id ? '#FFF' : 'transparent',
                          border: activeCoa === c.id ? '1px solid #5A9E6F60' : '1px solid transparent',
                          fontSize: 11, color: '#5A9E6F', textDecoration: 'line-through',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {c.action}
                      </div>
                    ))}
                    {sectionCoas.length === 0 && (
                      <div style={{ fontSize: 9, color: '#C4BFB4', fontStyle: 'italic', padding: '2px 8px' }}>empty</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Center: Active COA Workspace ────────────────────────────────── */}
        <div className="arrange-workspace" style={{ padding: '20px 28px', display: 'flex', gap: 24 }}>
          {!active ? (
            <div style={{ color: '#B5B0A8', fontSize: 13, paddingTop: 40, textAlign: 'center', flex: 1 }}>Select a COA from the left panel</div>
          ) : (
            <>
              {/* COA Details (left side of workspace) */}
              <div style={{ flex: 0, minWidth: 0, maxWidth: 560 }}>
              {/* Header */}
              <div style={{ marginBottom: 20 }}>
                {editingOutcome ? (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{active.action}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#8A8578' }}>IOT</span>
                      <input value={outcomeText} onChange={e => setOutcomeText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveOutcome(active.id); if (e.key === 'Escape') setEditingOutcome(false) }}
                        onBlur={() => saveOutcome(active.id)}
                        autoFocus placeholder="In order to achieve what?"
                        style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #C4725A', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div onClick={() => { setEditingOutcome(true); setOutcomeText(active.outcome ?? '') }} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{active.action}</div>
                    {active.outcome ? (
                      <div style={{ fontSize: 13, color: '#8A8578', fontStyle: 'italic', marginTop: 2 }}>IOT {active.outcome}</div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#B5B0A8', marginTop: 2 }}>Click to add outcome</div>
                    )}
                  </div>
                )}

                {/* Status + time horizon */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: active.status === 'completed' ? '#5A9E6F' : active.status === 'committed' ? '#C4725A' : '#8A8578' }}>
                    {active.status}
                  </span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {HORIZONS.filter(h => h.key !== 'unset').map(h => (
                      <button key={h.key} onClick={() => setTimeHorizon(active.id, h.key)}
                        style={{
                          padding: '2px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                          background: active.time_horizon === h.key ? h.color : 'transparent',
                          color: active.time_horizon === h.key ? '#FFF' : h.color,
                          border: `1px solid ${h.color}40`,
                        }}
                      >{h.label}</button>
                    ))}
                  </div>
                  {active.has_sub_mission && (
                    <span style={{ fontSize: 11, color: '#4B82AF', cursor: 'pointer' }} onClick={() => router.push(`/plan/${active.sub_mission_id}`)}>Sub-mission →</span>
                  )}
                </div>
              </div>

              {/* Dependencies */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Dependencies</div>
                {activeDeps.length === 0 && !linkingDepFrom && (
                  <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>None</div>
                )}
                {activeDeps.map(d => (
                  <div key={d.id} style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: d.is_hard ? '#C4504A' : '#8A8578', fontWeight: 600 }}>{d.is_hard ? 'Hard' : 'Soft'}:</span>
                    <span>After &quot;{d.depends_on_action}&quot;</span>
                    <span style={{ color: '#B5B0A8' }}>({d.reason})</span>
                    <button onClick={() => deleteDependency(d.id)} style={{ background: 'none', border: 'none', color: '#C4504A', fontSize: 9, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setLinkingDepFrom(linkingDepFrom ? null : active.id)}
                  style={{ ...smallBtn, marginTop: 4 }}>
                  {linkingDepFrom ? 'Cancel linking' : '+ Link dependency'}
                </button>
                {linkingDepFrom && (
                  <div style={{ fontSize: 11, color: '#4B82AF', marginTop: 4 }}>Click a COA in the kanban to set it as prerequisite</div>
                )}
              </div>

              {/* Resources */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Resources</div>
                {activeRes.length === 0 && !addingResource && (
                  <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>None</div>
                )}
                {activeRes.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 11 }}>
                    <select value={r.status} onChange={e => updateResourceStatus(active.id, r.id, e.target.value)}
                      style={{ fontSize: 10, border: '1px solid #E8E4DC', borderRadius: 3, padding: '1px 2px', color: r.status === 'met' ? '#5A9E6F' : r.status === 'partially_met' ? '#D4A744' : '#C4504A' }}>
                      <option value="needed">needed</option>
                      <option value="partially_met">partial</option>
                      <option value="met">met</option>
                    </select>
                    <span>{r.description}</span>
                    {r.quantity && <span style={{ color: '#8A8578' }}>({r.quantity} {r.unit})</span>}
                  </div>
                ))}
                {addingResource ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 4 }}>
                    <input value={resDesc} onChange={e => setResDesc(e.target.value)} placeholder="Description *" style={miniInput} />
                    <select value={resKind} onChange={e => setResKind(e.target.value)} style={{ ...miniInput, width: 80 }}>
                      {RESOURCE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input value={resQty} onChange={e => setResQty(e.target.value)} placeholder="Qty" type="number" style={{ ...miniInput, width: 50 }} />
                    <button onClick={addResource} style={{ ...smallBtn, background: '#5A9E6F', color: '#FFF', border: 'none' }}>Add</button>
                    <button onClick={() => setAddingResource(false)} style={smallBtn}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingResource(true)} style={{ ...smallBtn, marginTop: 4 }}>+ Add resource</button>
                )}
              </div>

              {/* Factor links */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Factor Links</div>
                {activeLinks.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>
                    No linked factors.{' '}
                    <span style={{ cursor: 'pointer', color: '#C4725A' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Link on COA page →</span>
                  </div>
                ) : activeLinks.map(l => {
                  const f = factorMap.get(l.factor_id)
                  if (!f) return null
                  return (
                    <div key={l.factor_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 11 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 4px', borderRadius: 3, fontWeight: 600,
                        background: l.relationship === 'aims_to_resolve' ? '#C4504A15' : '#E8E4DC40',
                        color: l.relationship === 'aims_to_resolve' ? '#C4504A' : '#8A8578',
                      }}>{l.relationship === 'aims_to_resolve' ? 'resolves' : 'accounts for'}</span>
                      <span style={{ color: f.status === 'resolved' ? '#B5B0A8' : '#2D2A26', textDecoration: f.status === 'resolved' ? 'line-through' : 'none' }}>
                        ({f.kind}) {f.name}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #E8E4DC' }}>
                {active.status !== 'completed' && (
                  <button onClick={() => markCoaCompleted(active.id)} style={{ padding: '6px 16px', background: '#5A9E6F', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Complete this COA
                  </button>
                )}
                <button onClick={() => router.push(`/plan/${missionId}/summary`)} style={smallBtn}>View summary</button>
              </div>
              </div>{/* end COA details */}

              {/* COA Thread (right side of workspace) */}
              <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', border: '1px solid #E8E4DC', borderRadius: 8, background: '#FAFAF7', height: 'fit-content', maxHeight: 480 }}>
                <div style={{ padding: '6px 10px', borderBottom: '1px solid #E8E4DC', fontSize: 10, fontWeight: 600, color: '#8A857D', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Thread
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                  {threadMessages.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic', paddingTop: 8 }}>No messages yet</div>
                  ) : (
                    threadMessages.map(msg => {
                      const isOwn = msg.user_id === currentUserId
                      const authorName = userNames[msg.user_id] ?? 'Unknown'
                      const color = getAuthorColor(msg.user_id, isOwn)
                      const time = new Date(msg.created_at)
                      const timeStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                        time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
                      return (
                        <div key={msg.id} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 8, color: '#C4BFB4', marginBottom: 1 }}>{timeStr}</div>
                          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 600, color }}>{isOwn ? 'You' : authorName}:</span>{' '}
                            {msg.description}
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>
                <div style={{ padding: '6px 8px', borderTop: '1px solid #E8E4DC' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      value={threadInput}
                      onChange={e => setThreadInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postThreadMessage() } }}
                      placeholder="Message…"
                      style={{ flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 11, outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button onClick={postThreadMessage} disabled={!threadInput.trim()}
                      style={{ ...smallBtn, fontSize: 9, background: threadInput.trim() ? '#2D2A26' : 'transparent', color: threadInput.trim() ? '#FFF' : '#B5B0A8', border: threadInput.trim() ? 'none' : '1px solid #E8E4DC' }}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Dependency creation modal ────────────────────────────────────── */}
      {depModal && (
        <div style={overlayStyle} onClick={() => { setDepModal(null); setLinkingDepFrom(null) }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Create dependency</div>
            <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8 }}>
              &quot;{coas.find(c => c.id === depModal.from)?.action}&quot; depends on &quot;{coas.find(c => c.id === depModal.to)?.action}&quot;
            </div>
            <input value={depReason} onChange={e => setDepReason(e.target.value)} placeholder="Why? (required)" autoFocus
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
            />
            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={depHard} onChange={e => setDepHard(e.target.checked)} /> Hard dependency
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createDependency} disabled={!depReason.trim()} style={{ padding: '6px 16px', background: depReason.trim() ? '#4B82AF' : '#E8E4DC', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create</button>
              <button onClick={() => { setDepModal(null); setLinkingDepFrom(null) }} style={{ padding: '6px 16px', background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Factor review modal ──────────────────────────────────────────── */}
      {reviewModal && (
        <div style={overlayStyle} onClick={() => setReviewModal(null)}>
          <div style={{ ...modalStyle, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {reviewModal.coaAction}{reviewModal.coaOutcome ? ` IOT ${reviewModal.coaOutcome}` : ''} is complete.
            </div>
            <div style={{ fontSize: 12, color: '#8A8578', marginBottom: 12 }}>
              This COA targeted these factors. Have any of them changed?
            </div>
            {reviewModal.factors.map(f => (
              <div key={f.id} style={{ padding: 8, border: '1px solid #E8E4DC', borderRadius: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>({f.kind}) {f.name}</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <button onClick={async () => {
                    await resolveFactorFromReview(f.id, reviewNotes[f.id] || '', f.kind === 'assumption' && (reviewCreateFact[f.id] ?? false), f.kind === 'assumption' ? (reviewFactText[f.id] || '') : '')
                    showToast(`Factor resolved: ${f.name}`)
                  }} style={{ ...smallBtn, color: '#5A9E6F' }}>Resolved</button>
                  <button onClick={() => showToast('Skipped')} style={smallBtn}>Skip</button>
                </div>
                <input value={reviewNotes[f.id] ?? ''} onChange={e => setReviewNotes(p => ({ ...p, [f.id]: e.target.value }))}
                  placeholder="Resolution note…" style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 4 }}
                />
                {f.kind === 'assumption' && (
                  <div style={{ fontSize: 10, color: '#8A8578' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={reviewCreateFact[f.id] ?? false} onChange={e => setReviewCreateFact(p => ({ ...p, [f.id]: e.target.checked }))} />
                      Assumption confirmed — create fact:
                    </label>
                    {reviewCreateFact[f.id] && (
                      <input value={reviewFactText[f.id] ?? ''} onChange={e => setReviewFactText(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder="Fact text…" style={{ width: '100%', padding: '3px 6px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4 }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setReviewModal(null)} style={{ padding: '6px 16px', background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#2D2A26', color: '#FFF', padding: '8px 20px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, opacity: toastVisible ? 1 : 0,
          transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 100,
        }}>{toastMsg}</div>
      )}
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #E8E4DC', borderRadius: 4,
  padding: '3px 8px', fontSize: 10, color: '#8A8578', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
}

const miniInput: React.CSSProperties = {
  padding: '4px 6px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 11, outline: 'none', fontFamily: 'inherit',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const modalStyle: React.CSSProperties = {
  background: '#FFF', borderRadius: 16, padding: '24px 28px', maxWidth: 440, width: '90%',
  border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '80vh', overflowY: 'auto',
}
