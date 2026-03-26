'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { COA, Factor, COADependency, COAResourceNeed, Mission } from '@/lib/types'

const HORIZONS: { key: COA['time_horizon']; label: string; color: string }[] = [
  { key: 'now', label: 'Now', color: '#5A9E6F' },
  { key: 'next', label: 'Next', color: '#4B82AF' },
  { key: 'later', label: 'Later', color: '#9B7EC8' },
  { key: 'unset', label: 'Unplaced', color: '#B5B0A8' },
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

  // Interaction state
  const [linkingDepFrom, setLinkingDepFrom] = useState<string | null>(null)
  const [depModal, setDepModal] = useState<{ from: string; to: string } | null>(null)
  const [depReason, setDepReason] = useState('')
  const [depHard, setDepHard] = useState(false)
  const [expandedCoa, setExpandedCoa] = useState<string | null>(null)
  const [addingResource, setAddingResource] = useState<string | null>(null)
  const [resDesc, setResDesc] = useState('')
  const [resKind, setResKind] = useState<string>('other')
  const [resQty, setResQty] = useState('')
  const [resUnit, setResUnit] = useState('')
  const [editingOutcome, setEditingOutcome] = useState<string | null>(null)
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
    setToastMsg(msg)
    setToastVisible(true)
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
    setCoas(Array.isArray(coaData) ? coaData : [])
    setFactors(Array.isArray(factorData) ? factorData : [])
    setDependencies(Array.isArray(depData) ? depData : [])

    // Load resources and factor links per COA
    const coaArr = Array.isArray(coaData) ? coaData : []
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

    setLoading(false)
  }, [missionId])

  useEffect(() => { loadData() }, [loadData])

  // --- Actions ---

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
    if (res.ok) {
      const dep = await res.json()
      setDependencies(prev => [...prev, dep])
      showToast('Dependency created')
    } else {
      const e = await res.json()
      showToast(e.error ?? 'Failed')
    }
    setDepModal(null)
    setDepReason('')
    setDepHard(false)
    setLinkingDepFrom(null)
  }

  async function deleteDependency(id: string) {
    const res = await fetch(`/api/missions/${missionId}/coa-dependencies/${id}`, { method: 'DELETE' })
    if (res.ok) setDependencies(prev => prev.filter(d => d.id !== id))
  }

  async function addResource(coaId: string) {
    if (!resDesc.trim()) return
    const res = await fetch(`/api/missions/${missionId}/coas/${coaId}/resources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: resDesc.trim(), kind: resKind, quantity: resQty ? Number(resQty) : null, unit: resUnit || null }),
    })
    if (res.ok) {
      const r = await res.json()
      setResources(prev => ({ ...prev, [coaId]: [...(prev[coaId] ?? []), r] }))
    }
    setAddingResource(null)
    setResDesc(''); setResKind('other'); setResQty(''); setResUnit('')
  }

  async function updateResourceStatus(coaId: string, resId: string, status: string) {
    await fetch(`/api/missions/${missionId}/coas/${coaId}/resources/${resId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setResources(prev => ({
      ...prev,
      [coaId]: (prev[coaId] ?? []).map(r => r.id === resId ? { ...r, status: status as COAResourceNeed['status'] } : r),
    }))
  }

  async function saveOutcome(coaId: string) {
    await fetch(`/api/missions/${missionId}/coas/${coaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: outcomeText.trim() || null }),
    })
    setCoas(prev => prev.map(c => c.id === coaId ? { ...c, outcome: outcomeText.trim() || null } : c))
    setEditingOutcome(null)
  }

  async function toggleFactorRelationship(coaId: string, factorId: string, currentRel: string) {
    const newRel = currentRel === 'accounts_for' ? 'aims_to_resolve' : 'accounts_for'
    // Unlink then relink with new relationship
    await fetch(`/api/missions/${missionId}/coas/${coaId}/factors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factor_id: factorId }), // unlink
    })
    await fetch(`/api/missions/${missionId}/coas/${coaId}/factors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factor_id: factorId, relationship: newRel }),
    })
    setCoaFactorLinks(prev => ({
      ...prev,
      [coaId]: (prev[coaId] ?? []).map(l => l.factor_id === factorId ? { ...l, relationship: newRel } : l),
    }))
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
      } else {
        showToast('COA completed')
      }
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
    showToast('Note added')
    setNoteInput('')
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  const factorMap = new Map(factors.map(f => [f.id, f]))
  const totalFactors = factors.length
  const accountedFactors = new Set<string>()
  Object.values(coaFactorLinks).forEach(links => links.forEach(l => accountedFactors.add(l.factor_id)))
  const pct = totalFactors > 0 ? Math.round((accountedFactors.size / totalFactors) * 100) : 0

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8, display: 'flex', gap: 8 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>COA page</span>
      </div>

      <h1 style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', margin: '0 0 8px' }}>
        Arrange plan for: <span style={{ color: '#C4725A' }}>{mission?.name ?? ''}</span>
      </h1>
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 16 }}>
        {accountedFactors.size} of {totalFactors} factors accounted for ({pct}%)
        {pct < 100 && <span style={{ cursor: 'pointer', color: '#C4725A', marginLeft: 8 }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Link more →</span>}
      </div>

      {/* Dependency linking mode indicator */}
      {linkingDepFrom && (
        <div style={{ padding: '8px 16px', background: '#4B82AF15', border: '1px solid #4B82AF40', borderRadius: 6, marginBottom: 12, fontSize: 12, color: '#4B82AF' }}>
          Click a COA to set it as prerequisite for: <strong>{coas.find(c => c.id === linkingDepFrom)?.action}</strong>
          <button onClick={() => setLinkingDepFrom(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#C4504A', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Cancel</button>
        </div>
      )}

      {/* Time horizon sections */}
      {HORIZONS.map(h => {
        const sectionCoas = coas.filter(c => c.time_horizon === h.key).sort((a, b) => a.sort_order - b.sort_order)
        return (
          <div key={h.key} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: h.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {h.label}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#8A8578' }}>({sectionCoas.length} COAs)</span>
            </div>
            {sectionCoas.length === 0 ? (
              <div style={{ padding: '8px 16px', color: '#B5B0A8', fontSize: 11, fontStyle: 'italic', border: '1px dashed #E8E4DC', borderRadius: 6 }}>
                No COAs in {h.label.toLowerCase()}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sectionCoas.map(c => {
                  const coaDeps = dependencies.filter(d => d.coa_id === c.id)
                  const coaRes = resources[c.id] ?? []
                  const coaLinks = coaFactorLinks[c.id] ?? []
                  const accountsFor = coaLinks.filter(l => l.relationship === 'accounts_for').length
                  const aimsToResolve = coaLinks.filter(l => l.relationship === 'aims_to_resolve').length
                  const isExpanded = expandedCoa === c.id

                  return (
                    <div key={c.id} style={{
                      borderStyle: 'solid', borderRadius: 8, background: '#FFF', padding: '10px 14px',
                      borderWidth: linkingDepFrom === c.id ? 2 : 1,
                      borderColor: linkingDepFrom === c.id ? '#4B82AF' : '#E8E4DC',
                    }}>
                      {/* COA header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          {/* Action / outcome */}
                          {editingOutcome === c.id ? (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2A26', marginBottom: 4 }}>{c.action}</div>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: '#8A8578' }}>IOT</span>
                                <input value={outcomeText} onChange={e => setOutcomeText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveOutcome(c.id); if (e.key === 'Escape') setEditingOutcome(null) }}
                                  onBlur={() => saveOutcome(c.id)}
                                  autoFocus placeholder="In order to achieve what?"
                                  style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid #C4725A', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => { setEditingOutcome(c.id); setOutcomeText(c.outcome ?? '') }}
                              style={{ fontSize: 13, color: '#2D2A26', cursor: 'pointer', marginBottom: 4 }}
                            >
                              <strong>{c.action}</strong>
                              {c.outcome ? <span style={{ fontStyle: 'italic', color: '#8A8578' }}> IOT {c.outcome}</span> : <span style={{ color: '#B5B0A8', fontSize: 11 }}> (click to add outcome)</span>}
                            </div>
                          )}

                          {/* Status + stats */}
                          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#8A8578', flexWrap: 'wrap' }}>
                            <span style={{ color: c.status === 'completed' ? '#5A9E6F' : c.status === 'committed' ? '#C4725A' : '#8A8578', fontWeight: 600 }}>{c.status}</span>
                            <span>Accounts for {accountsFor}, aims to resolve {aimsToResolve}</span>
                            <span>{coaRes.length} resources, {coaRes.filter(r => r.status === 'met').length} met</span>
                            {c.has_sub_mission && <span style={{ color: '#4B82AF', cursor: 'pointer' }} onClick={() => router.push(`/plan/${c.sub_mission_id}`)}>Sub-mission</span>}
                            {c.big_outcome_id && <span style={{ color: '#5A9E6F' }}>On Map</span>}
                          </div>

                          {/* Dependencies */}
                          {coaDeps.length > 0 && (
                            <div style={{ marginTop: 4, fontSize: 10 }}>
                              {coaDeps.map(d => (
                                <div key={d.id} style={{ color: d.is_hard ? '#C4504A' : '#8A8578', display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span>{d.is_hard ? 'Hard' : 'Soft'} dep:</span>
                                  <span>After &quot;{d.depends_on_action}&quot;</span>
                                  <span title={d.reason} style={{ color: '#B5B0A8', cursor: 'help' }}>({d.reason})</span>
                                  <button onClick={() => deleteDependency(d.id)} style={{ background: 'none', border: 'none', color: '#C4504A', fontSize: 9, cursor: 'pointer' }}>×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                          {/* Time horizon buttons */}
                          <div style={{ display: 'flex', gap: 2 }}>
                            {HORIZONS.filter(hh => hh.key !== 'unset').map(hh => (
                              <button key={hh.key} onClick={() => setTimeHorizon(c.id, hh.key)}
                                style={{
                                  padding: '2px 5px', fontSize: 9, borderRadius: 3, cursor: 'pointer', fontWeight: 600,
                                  background: c.time_horizon === hh.key ? hh.color : 'transparent',
                                  color: c.time_horizon === hh.key ? '#FFF' : hh.color,
                                  border: `1px solid ${hh.color}40`,
                                }}
                              >{hh.label}</button>
                            ))}
                          </div>
                          <button onClick={() => {
                            if (linkingDepFrom) {
                              if (linkingDepFrom !== c.id) setDepModal({ from: linkingDepFrom, to: c.id })
                              setLinkingDepFrom(null)
                            } else {
                              setLinkingDepFrom(c.id)
                            }
                          }} style={smallBtn}>
                            {linkingDepFrom ? (linkingDepFrom === c.id ? 'Cancel' : 'Set as prerequisite') : 'Link dependency'}
                          </button>
                          <button onClick={() => setAddingResource(addingResource === c.id ? null : c.id)} style={smallBtn}>Add resource</button>
                          <button onClick={() => setExpandedCoa(isExpanded ? null : c.id)} style={smallBtn}>{isExpanded ? 'Hide factors' : 'Factor links'}</button>
                          {c.status !== 'completed' && <button onClick={() => markCoaCompleted(c.id)} style={{ ...smallBtn, color: '#5A9E6F' }}>Complete</button>}
                        </div>
                      </div>

                      {/* Resource entry */}
                      {addingResource === c.id && (
                        <div style={{ marginTop: 8, padding: 8, background: '#F8F7F4', borderRadius: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <input value={resDesc} onChange={e => setResDesc(e.target.value)} placeholder="Description *" style={miniInput} />
                          <select value={resKind} onChange={e => setResKind(e.target.value)} style={{ ...miniInput, width: 80 }}>
                            {RESOURCE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          <input value={resQty} onChange={e => setResQty(e.target.value)} placeholder="Qty" type="number" style={{ ...miniInput, width: 50 }} />
                          <input value={resUnit} onChange={e => setResUnit(e.target.value)} placeholder="Unit" style={{ ...miniInput, width: 60 }} />
                          <button onClick={() => addResource(c.id)} style={{ ...smallBtn, background: '#5A9E6F', color: '#FFF', border: 'none' }}>Add</button>
                        </div>
                      )}

                      {/* Resources list */}
                      {coaRes.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#8A8578' }}>
                          {coaRes.map(r => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                              <select value={r.status} onChange={e => updateResourceStatus(c.id, r.id, e.target.value)}
                                style={{ fontSize: 9, border: '1px solid #E8E4DC', borderRadius: 3, padding: '0 2px', color: r.status === 'met' ? '#5A9E6F' : r.status === 'partially_met' ? '#D4A744' : '#C4504A' }}>
                                <option value="needed">needed</option>
                                <option value="partially_met">partial</option>
                                <option value="met">met</option>
                              </select>
                              <span>{r.description}</span>
                              {r.quantity && <span>({r.quantity} {r.unit})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Factor links */}
                      {isExpanded && (
                        <div style={{ marginTop: 8, padding: 8, background: '#F8F7F4', borderRadius: 6, fontSize: 11 }}>
                          {coaLinks.length === 0 ? (
                            <div style={{ color: '#B5B0A8', fontStyle: 'italic' }}>No linked factors</div>
                          ) : coaLinks.map(l => {
                            const f = factorMap.get(l.factor_id)
                            if (!f) return null
                            return (
                              <div key={l.factor_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <button onClick={() => toggleFactorRelationship(c.id, l.factor_id, l.relationship)}
                                  style={{
                                    fontSize: 9, padding: '1px 4px', borderRadius: 3, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                                    background: l.relationship === 'aims_to_resolve' ? '#C4504A15' : '#E8E4DC40',
                                    color: l.relationship === 'aims_to_resolve' ? '#C4504A' : '#8A8578',
                                    border: `1px solid ${l.relationship === 'aims_to_resolve' ? '#C4504A40' : '#E8E4DC'}`,
                                  }}
                                >{l.relationship === 'aims_to_resolve' ? 'resolves' : 'accounts for'}</button>
                                <span style={{ color: f.status === 'resolved' ? '#B5B0A8' : '#2D2A26', textDecoration: f.status === 'resolved' ? 'line-through' : 'none' }}>
                                  ({f.kind}) {f.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Bottom */}
      <div style={{ marginTop: 24, borderTop: '1px solid #E8E4DC', paddingTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={() => router.push(`/plan/${missionId}/summary`)} style={{ background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          View plan summary
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNote() }}
            placeholder="Add a note to the mission log…"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={addNote} style={smallBtn}>Add note</button>
        </div>
      </div>

      {/* Dependency creation modal */}
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
              <input type="checkbox" checked={depHard} onChange={e => setDepHard(e.target.checked)} /> Hard dependency (true logical requirement)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createDependency} disabled={!depReason.trim()} style={{ padding: '6px 16px', background: depReason.trim() ? '#4B82AF' : '#E8E4DC', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create</button>
              <button onClick={() => { setDepModal(null); setLinkingDepFrom(null) }} style={{ padding: '6px 16px', background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Factor review modal */}
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
                    const note = reviewNotes[f.id] || ''
                    const createFact = f.kind === 'assumption' && (reviewCreateFact[f.id] ?? false)
                    const factText = f.kind === 'assumption' ? (reviewFactText[f.id] || '') : ''
                    await resolveFactorFromReview(f.id, note, createFact, factText)
                    showToast(`Factor resolved: ${f.name}`)
                  }} style={{ ...smallBtn, color: '#5A9E6F' }}>Resolved</button>
                  <button onClick={() => showToast('Skipped')} style={smallBtn}>Skip for now</button>
                </div>
                <input value={reviewNotes[f.id] ?? ''} onChange={e => setReviewNotes(p => ({ ...p, [f.id]: e.target.value }))}
                  placeholder="Resolution note…" style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 4 }}
                />
                {f.kind === 'assumption' && (
                  <div style={{ fontSize: 10, color: '#8A8578' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={reviewCreateFact[f.id] ?? false} onChange={e => setReviewCreateFact(p => ({ ...p, [f.id]: e.target.checked }))} />
                      Assumption confirmed — create a fact:
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
  padding: '2px 6px', fontSize: 9, color: '#8A8578', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
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
