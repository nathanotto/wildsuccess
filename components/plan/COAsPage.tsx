'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Factor, COA, FactorKind } from '@/lib/types'
import { getAuthorColor, formatAuthorTag } from '@/lib/author-colors'
import { useRealtimeMission } from '@/lib/useRealtimeMission'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { COLORS } from '@/lib/theme'

const KIND_ORDER: FactorKind[] = ['success', 'driver', 'constraint', 'fact', 'assumption']
const KIND_LABELS: Record<string, string> = {
  success: 'Successes', driver: 'Drivers', constraint: 'Constraints', fact: 'Facts', assumption: 'Assumptions',
}
const KIND_COLORS: Record<string, string> = {
  success: COLORS.primary, driver: '#5A9E6F', constraint: '#C4504A', fact: '#4B82AF', assumption: '#9B7EC8',
}

interface Props {
  missionId: string
}

export default function COAsPage({ missionId }: Props) {
  const router = useRouter()
  const [missionName, setMissionName] = useState('')
  const [coas, setCoas] = useState<COA[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [selectedCoaId, setSelectedCoaId] = useState<string | null>(null)
  const [coaFactorLinks, setCoaFactorLinks] = useState<Record<string, Set<string>>>({}) // coaId -> Set<factorId>
  const [actionInput, setActionInput] = useState('')
  const [outcomeInput, setOutcomeInput] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast, visible, show } = useActionToast()
  const actionRef = useRef<HTMLInputElement>(null)

  function handleSaveLinks(coaId: string) {
    const count = coaFactorLinks[coaId]?.size ?? 0
    const allLinked = new Set<string>()
    Object.values(coaFactorLinks).forEach(s => s.forEach(fid => allLinked.add(fid)))
    const unmatched = factors.filter(f => !allLinked.has(f.id)).length
    const pctDone = factors.length > 0 ? Math.round((allLinked.size / factors.length) * 100) : 0
    show(`save-${coaId}`, `You linked ${count} factor${count !== 1 ? 's' : ''}. ${unmatched} unmatched factor${unmatched !== 1 ? 's' : ''} remain, ${pctDone}% done.`)
    setSelectedCoaId(null)
  }

  const loadData = useCallback(async () => {
    const [missions, coaData, factorData] = await Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/coas`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/factors`).then(r => r.json()),
    ])
    const m = missions.find((ms: { id: string }) => ms.id === missionId)
    setMissionName(m?.name ?? '')
    setCoas(coaData)
    setFactors(factorData)

    // Load factor links for each COA
    const linkMap: Record<string, Set<string>> = {}
    await Promise.all(coaData.map(async (c: COA) => {
      const res = await fetch(`/api/missions/${missionId}/coas/${c.id}/factors`)
      const data: { factor_id: string; relationship: string }[] = await res.json()
      linkMap[c.id] = new Set(data.map(d => d.factor_id))
    }))
    setCoaFactorLinks(linkMap)
    setLoading(false)
  }, [missionId])

  useEffect(() => { loadData() }, [loadData])

  // Real-time: other users' COA and factor link changes
  useRealtimeMission(missionId, {
    onCoaChange: (eventType, payload) => {
      if (eventType === 'DELETE') {
        const old = payload.old as Record<string, unknown>
        setCoas(prev => prev.filter(c => c.id !== old.id))
      } else {
        // INSERT or UPDATE — refetch for proper author names and computed fields
        loadData()
      }
    },
    onFactorChange: (eventType) => {
      // Factor added/removed — refresh factors list
      if (eventType === 'INSERT' || eventType === 'DELETE') {
        fetch(`/api/missions/${missionId}/factors`).then(r => r.json()).then(data => {
          if (Array.isArray(data)) setFactors(data)
        })
      }
    },
    onLinkChange: () => {
      // Factor-COA link changed — reload link data
      loadData()
    },
  })

  async function handleAddCoa() {
    if (!actionInput.trim()) return
    const res = await fetch(`/api/missions/${missionId}/coas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionInput.trim(), outcome: outcomeInput.trim() || null }),
    })
    if (res.ok) {
      const c = await res.json()
      setCoas(prev => [...prev, c])
      setCoaFactorLinks(prev => ({ ...prev, [c.id]: new Set() }))
      setActionInput('')
      setOutcomeInput('')
      actionRef.current?.focus()
    }
  }

  async function handleDeleteCoa(id: string) {
    const res = await fetch(`/api/missions/${missionId}/coas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoas(prev => prev.filter(c => c.id !== id))
      if (selectedCoaId === id) setSelectedCoaId(null)
      setCoaFactorLinks(prev => { const n = { ...prev }; delete n[id]; return n })
      show('coa-del', 'COA deleted')
    }
  }

  async function toggleFactorLink(coaId: string, factorId: string) {
    const res = await fetch(`/api/missions/${missionId}/coas/${coaId}/factors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factor_id: factorId }),
    })
    if (res.ok) {
      const { action } = await res.json()
      setCoaFactorLinks(prev => {
        const updated = new Set(prev[coaId] ?? [])
        if (action === 'linked') updated.add(factorId)
        else updated.delete(factorId)
        return { ...prev, [coaId]: updated }
      })
      // Update COA linked factor count
      setCoas(prev => prev.map(c => {
        if (c.id !== coaId) return c
        const count = (coaFactorLinks[coaId]?.size ?? 0) + (action === 'linked' ? 1 : -1)
        return { ...c, linked_factor_count: Math.max(0, count) }
      }))
    }
  }

  async function handlePromote(coaId: string, target: string) {
    const res = await fetch(`/api/missions/${missionId}/coas/${coaId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    if (!res.ok) { show(`promote-${coaId}`, 'Promote failed — try again', 'error'); return }
    const data = await res.json()

    const coaName = coas.find(c => c.id === coaId)?.action ?? 'COA'
    if (target === 'hopper') {
      show(`promote-${coaId}`, `"${coaName}" added to hopper`)
      setCoas(prev => prev.map(c => c.id === coaId ? { ...c, status: 'committed' } : c))
    } else if (target === 'sub_mission') {
      router.push(`/plan/${data.mission.id}/factors?kind=success`)
    } else if (target === 'big_outcome') {
      show(`promote-${coaId}`, `"${coaName}" added to Map as Big Outcome`)
      setCoas(prev => prev.map(c => c.id === coaId ? { ...c, status: 'committed', big_outcome_id: data.outcome.id, big_outcome_name: data.outcome.name } : c))
    }
  }

  async function moveCoa(id: string, direction: 'up' | 'down') {
    const sorted = [...coas].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(c => c.id === id)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= sorted.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = sorted[idx], b = sorted[swapIdx]
    await Promise.all([
      fetch(`/api/missions/${missionId}/coas/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/missions/${missionId}/coas/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
    setCoas(prev => prev.map(c => {
      if (c.id === a.id) return { ...c, sort_order: b.sort_order }
      if (c.id === b.id) return { ...c, sort_order: a.sort_order }
      return c
    }))
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  // Compute accounted factors
  const allLinkedFactors = new Set<string>()
  Object.values(coaFactorLinks).forEach(s => s.forEach(fid => allLinkedFactors.add(fid)))
  const totalFactors = factors.length
  const accountedFactors = factors.filter(f => allLinkedFactors.has(f.id)).length
  const pct = totalFactors > 0 ? Math.round((accountedFactors / totalFactors) * 100) : 0
  const pctColor = pct < 50 ? '#C4504A' : pct < 80 ? '#D4A744' : '#5A9E6F'

  const sortedCoas = [...coas].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Nav */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8, display: 'flex', gap: 8 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ color: '#2D2A26', fontWeight: 600 }}>Plan COAs</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary`)}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
      </div>

      <h1 style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', margin: '0 0 12px' }}>
        Plan courses of action for: <span style={{ color: COLORS.primary }}>{missionName}</span>
      </h1>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 8, background: '#F0EDE6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pctColor, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: pctColor }}>{pct}%</span>
        </div>
        <div style={{ fontSize: 11, color: '#8A8578' }}>
          {accountedFactors} of {totalFactors} factors accounted for
        </div>
      </div>

      {/* COA input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        <input
          ref={actionRef}
          value={actionInput}
          onChange={e => setActionInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddCoa() }}
          placeholder="Do what? e.g. 'buy ham'"
          style={{
            flex: 55, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC',
            fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B5B0A8', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>IOT</span>
        <input
          value={outcomeInput}
          onChange={e => setOutcomeInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddCoa() }}
          placeholder="To achieve what? e.g. 'make a ham sandwich'"
          style={{
            flex: 35, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC',
            fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <button onClick={handleAddCoa} style={{
          padding: '8px 14px', background: COLORS.primary, color: '#FFF', border: 'none',
          borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}>+ Add</button>
      </div>

      {/* COA list */}
      {sortedCoas.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#B5B0A8', fontSize: 12, fontStyle: 'italic' }}>
          No courses of action yet. Add one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedCoas.map(c => {
            const linkCount = coaFactorLinks[c.id]?.size ?? 0
            const isSelected = selectedCoaId === c.id
            return (
              <div key={c.id}>
                <div style={{
                  padding: '8px 12px', border: isSelected ? `2px solid ${COLORS.primary}` : '1px solid #E8E4DC',
                  borderRadius: 8, background: isSelected ? COLORS.primaryFaint : '#FFF',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <button onClick={() => moveCoa(c.id, 'up')} style={arrowBtn}>↑</button>
                  <button onClick={() => moveCoa(c.id, 'down')} style={arrowBtn}>↓</button>
                  <span style={{ color: '#C4504A', fontSize: 12, fontWeight: 700, minWidth: 28 }}>♥ {linkCount}</span>
                  <button onClick={() => handleDeleteCoa(c.id)} style={{ ...arrowBtn, color: '#C4504A' }}>del</button>
                  <span style={{ color: getAuthorColor(c.user_id, !!c.is_own), fontWeight: 600, fontSize: 11 }}>{formatAuthorTag(c.author_name, c.is_own)}</span>
                  <span
                    onClick={() => setSelectedCoaId(isSelected ? null : c.id)}
                    style={{ color: isSelected ? COLORS.primary : '#2D2A26', cursor: 'pointer', flex: 1, fontSize: 13 }}
                  >{c.action}{c.outcome ? <><span style={{ color: '#B5B0A8', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, margin: '0 4px' }}>IOT</span>{c.outcome}</> : ''}</span>
                  {c.time_horizon !== 'unset' && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#4B82AF', background: '#4B82AF15', padding: '1px 5px', borderRadius: 3 }}>{c.time_horizon}</span>
                  )}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => isSelected ? handleSaveLinks(c.id) : setSelectedCoaId(c.id)}
                      style={{
                        background: isSelected ? COLORS.primary : '#F8F7F4', border: isSelected ? `1px solid ${COLORS.primary}` : '1px solid #E8E4DC',
                        borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                        color: isSelected ? '#FFF' : COLORS.primary, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >{isSelected ? 'Save' : 'Link factors'}</button>
                    <ActionToast message={toast?.id === `save-${c.id}` ? toast.msg : null} visible={visible && toast?.id === `save-${c.id}`} position="left" />
                  </div>

                  {/* Status indicators */}
                  {c.has_sub_mission && c.sub_mission_id && (
                    <span
                      onClick={() => router.push(`/plan/${c.sub_mission_id}`)}
                      style={{ fontSize: 10, color: '#4B82AF', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >Sub-mission</span>
                  )}
                  {c.big_outcome_id && (
                    <span
                      onClick={() => router.push('/map')}
                      style={{ fontSize: 10, color: '#5A9E6F', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >On Map</span>
                  )}

                  {/* Action buttons - visible when COA has linked factors and linking panel is closed */}
                  {linkCount > 0 && !isSelected && !c.has_sub_mission && !c.big_outcome_id && c.status === 'proposed' && (
                    <div style={{ position: 'relative', display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => handlePromote(c.id, 'hopper')} style={actionBtn}>Send to hopper</button>
                      <button onClick={() => handlePromote(c.id, 'sub_mission')} style={actionBtn}>Plan this</button>
                      <button onClick={() => handlePromote(c.id, 'big_outcome')} style={actionBtn}>Add to Map</button>
                      <ActionToast message={toast?.id === `promote-${c.id}` ? toast.msg : null} visible={visible && toast?.id === `promote-${c.id}`} type={toast?.type} position="above" />
                    </div>
                  )}
                </div>

                {/* Factor linking table */}
                {isSelected && (
                  <div style={{ margin: '8px 0 4px', padding: 12, background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E4DC' }}>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: COLORS.primary, marginBottom: 10 }}>
                      &gt;&gt;&gt; Click factors for: ♥ <strong>{c.action}</strong> &lt;&lt;&lt;
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                      {KIND_ORDER.map(kind => {
                        const kindFactors = factors.filter(f => f.kind === kind).sort((a, b) => a.sort_order - b.sort_order)
                        return (
                          <div key={kind}>
                            <div style={{
                              fontSize: 10, fontWeight: 700, color: KIND_COLORS[kind],
                              background: KIND_COLORS[kind] + '15', padding: '3px 6px', borderRadius: 4, marginBottom: 6,
                              textAlign: 'center',
                            }}>{KIND_LABELS[kind]}</div>
                            {kindFactors.map(f => {
                              const isLinked = coaFactorLinks[c.id]?.has(f.id)
                              // Count how many COAs link this factor
                              let totalLinks = 0
                              Object.values(coaFactorLinks).forEach(s => { if (s.has(f.id)) totalLinks++ })
                              const unallocated = totalLinks === 0
                              return (
                                <div
                                  key={f.id}
                                  onClick={() => toggleFactorLink(c.id, f.id)}
                                  style={{
                                    fontSize: 11, padding: '2px 4px', cursor: 'pointer', borderRadius: 3,
                                    color: isLinked ? '#C4504A' : unallocated ? '#9E2A2A' : '#2D2A26',
                                    fontWeight: isLinked || unallocated ? 600 : 400,
                                    background: isLinked ? '#C4504A10' : 'transparent',
                                    marginBottom: 2,
                                  }}
                                >
                                  <span style={{ color: isLinked ? '#C4504A' : unallocated ? '#9E2A2A' : '#8A8578', fontSize: 10 }}>{totalLinks}</span> {isLinked ? '♥' : '|'} {f.name}
                                </div>
                              )
                            })}
                            {kindFactors.length === 0 && (
                              <div style={{ fontSize: 10, color: '#B5B0A8', fontStyle: 'italic' }}>none</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Factors reference — hidden when a COA is selected for linking */}
      {factors.length > 0 && !selectedCoaId && (
        <div style={{ marginTop: 32, borderTop: '1px solid #E8E4DC', paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2D2A26', marginBottom: 12 }}>Factors for this mission</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {KIND_ORDER.map(kind => {
              const kindFactors = factors.filter(f => f.kind === kind).sort((a, b) => a.sort_order - b.sort_order)
              return (
                <div key={kind}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: KIND_COLORS[kind],
                    background: KIND_COLORS[kind] + '15', padding: '3px 6px', borderRadius: 4, marginBottom: 6,
                    textAlign: 'center',
                  }}>{KIND_LABELS[kind]}</div>
                  {kindFactors.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#B5B0A8', fontStyle: 'italic' }}>none</div>
                  ) : kindFactors.map(f => {
                    let count = 0
                    Object.values(coaFactorLinks).forEach(s => { if (s.has(f.id)) count++ })
                    return (
                      <div key={f.id} style={{
                        fontSize: 11, padding: '1px 0',
                        color: count === 0 ? '#9E2A2A' : '#2D2A26',
                        fontWeight: count === 0 ? 600 : 400,
                      }}>
                        <span style={{ color: count === 0 ? '#9E2A2A' : '#8A8578', fontSize: 10, marginRight: 4 }}>{count}</span>
                        {f.name}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}


    </div>
  )
}

const arrowBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#B5B0A8', cursor: 'pointer', width: 14, textAlign: 'center',
}

const actionBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #E8E4DC', borderRadius: 4,
  padding: '2px 6px', fontSize: 9, color: '#8A8578', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
}
