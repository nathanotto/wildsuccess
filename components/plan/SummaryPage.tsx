'use client'
import { useState, useEffect, useCallback } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Factor, COA, COADependency, COAResourceNeed, MissionLogEntry, Mission, MissionValueLink, FactorKind } from '@/lib/types'

const HORIZONS: { key: COA['time_horizon']; label: string; color: string }[] = [
  { key: 'now', label: 'Now', color: '#5A9E6F' },
  { key: 'next', label: 'Next', color: '#4B82AF' },
  { key: 'later', label: 'Later', color: '#9B7EC8' },
]

const KIND_ABBREV: Record<FactorKind, string> = {
  success: 'succ', driver: 'driv', constraint: 'cons', fact: 'fact', assumption: 'assu',
}

interface Props {
  missionId: string
}

export default function SummaryPage({ missionId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPrint = searchParams.get('print') === 'true'
  const [mission, setMission] = useState<Mission | null>(null)
  const [allMissions, setAllMissions] = useState<Mission[]>([])
  const [coas, setCoas] = useState<COA[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [dependencies, setDependencies] = useState<COADependency[]>([])
  const [resources, setResources] = useState<Record<string, COAResourceNeed[]>>({})
  const [coaFactorLinks, setCoaFactorLinks] = useState<Record<string, { factor_id: string; relationship: string }[]>>({})
  const [valueLinks, setValueLinks] = useState<MissionValueLink[]>([])
  const [values, setValues] = useState<{ id: string; name: string }[]>([])
  const [log, setLog] = useState<MissionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [logFilter, setLogFilter] = useState('')
  const [expandedFactors, setExpandedFactors] = useState<Record<string, boolean>>({}) // "coaId:kind" → expanded
  const [showUnaccounted, setShowUnaccounted] = useState(false)
  const { toast, visible, show } = useActionToast()

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
      setCoas(prev => prev.map(c => c.id === coaId ? { ...c, status: 'committed', big_outcome_id: data.outcome.id } : c))
    }
  }

  const loadData = useCallback(async () => {
    const [missionsData, coaData, factorData, depData, vlData, valData, logData] = await Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/coas`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/factors`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/coa-dependencies`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/value-links`).then(r => r.json()),
      fetch('/api/values').then(r => r.json()),
      fetch(`/api/missions/${missionId}/log`).then(r => r.json()),
    ])
    const missions = Array.isArray(missionsData) ? missionsData : []
    setAllMissions(missions)
    setMission(missions.find((m: Mission) => m.id === missionId) ?? null)
    setCoas(Array.isArray(coaData) ? coaData : [])
    setFactors(Array.isArray(factorData) ? factorData : [])
    setDependencies(Array.isArray(depData) ? depData : [])
    setValueLinks(Array.isArray(vlData) ? vlData : [])
    setValues(Array.isArray(valData) ? valData : [])
    setLog(Array.isArray(logData) ? logData : [])

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

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  if (!mission) return <div style={{ padding: 40, color: '#C4504A' }}>Mission not found</div>

  const factorMap = new Map(factors.map(f => [f.id, f]))
  const valueMap = new Map(values.map(v => [v.id, v.name]))

  // Compute health
  const allLinked = new Set<string>()
  Object.values(coaFactorLinks).forEach(links => links.forEach(l => allLinked.add(l.factor_id)))
  const unaccounted = factors.filter(f => !allLinked.has(f.id) && f.status === 'active')
  const untestedAssumptions = factors.filter(f => f.kind === 'assumption' && f.status === 'active')
  const allRes = Object.values(resources).flat()
  const metRes = allRes.filter(r => r.status === 'met')
  const resolvedFactors = factors.filter(f => f.status === 'resolved')

  // Ancestry
  const ancestry: { id: string; name: string }[] = []
  let cur: Mission | undefined = mission
  while (cur?.parent_mission_id) {
    const parent = allMissions.find(m => m.id === cur!.parent_mission_id)
    if (!parent) break
    ancestry.unshift(parent)
    cur = parent
  }

  // Child missions
  const childMissions = allMissions.filter(m => m.parent_mission_id === missionId)

  const successFactors = factors.filter(f => f.kind === 'success' && f.status === 'active')
  const FACTOR_KINDS_FOR_COAS: { kind: FactorKind; label: string; color: string }[] = [
    { kind: 'driver', label: 'Drivers', color: '#5A9E6F' },
    { kind: 'fact', label: 'Facts', color: '#4B82AF' },
    { kind: 'constraint', label: 'Constraints', color: '#C4504A' },
    { kind: 'assumption', label: 'Assumptions', color: '#9B7EC8' },
  ]

  function toggleFactorSection(coaId: string, kind: string) {
    const key = `${coaId}:${kind}`
    setExpandedFactors(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const ALL_FACTOR_KINDS: { kind: FactorKind; label: string }[] = [
    { kind: 'driver', label: 'Drivers' },
    { kind: 'constraint', label: 'Constraints' },
    { kind: 'fact', label: 'Facts' },
    { kind: 'assumption', label: 'Assumptions' },
  ]

  // ============ PRINT VIEW ============
  if (isPrint) {
    return (
      <>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { font-size: 11px; }
          }
        `}</style>
        <div style={{ padding: '16px 24px', maxWidth: 700, margin: '0 auto', fontFamily: 'inherit', fontSize: 12, color: '#2D2A26', lineHeight: 1.5 }}>
          <div className="no-print" style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => window.print()} style={{ padding: '4px 12px', background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Print</button>
            <button onClick={() => router.push(`/plan/${missionId}/summary`)} style={{ padding: '4px 12px', background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Back to summary</button>
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{mission.name}</h1>
          {mission.description && <p style={{ fontSize: 11, margin: '0 0 8px', color: '#444' }}>{mission.description}</p>}
          <div style={{ fontSize: 9, color: '#888', marginBottom: 12 }}>
            {mission.status} · {allLinked.size}/{factors.filter(f => f.status === 'active').length} factors accounted for
            {allRes.length > 0 && <> · {metRes.length}/{allRes.length} resources met</>}
          </div>

          {/* Intended results */}
          {successFactors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 4px', color: '#C4725A' }}>Intended Results</h2>
              {successFactors.map(f => (
                <div key={f.id} style={{ paddingLeft: 10, borderLeft: '2px solid #C4725A40', marginBottom: 2, fontSize: 11 }}>{f.name}</div>
              ))}
            </div>
          )}

          {/* Intended actions by horizon */}
          <h2 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>Intended Actions</h2>
          {HORIZONS.map(h => {
            const sectionCoas = coas.filter(c => c.time_horizon === h.key).sort((a, b) => a.sort_order - b.sort_order)
            if (sectionCoas.length === 0) return null
            return (
              <div key={h.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#666', marginBottom: 3 }}>{h.label}</div>
                {sectionCoas.map(c => {
                  const coaDeps = dependencies.filter(d => d.coa_id === c.id)
                  const coaRes = resources[c.id] ?? []
                  const coaLinks = coaFactorLinks[c.id] ?? []

                  const linkedByKind: Record<string, Factor[]> = {}
                  coaLinks.forEach(l => {
                    const f = factorMap.get(l.factor_id)
                    if (f && f.kind !== 'success') {
                      if (!linkedByKind[f.kind]) linkedByKind[f.kind] = []
                      linkedByKind[f.kind].push(f)
                    }
                  })

                  return (
                    <div key={c.id} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '1px solid #ddd' }}>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>
                        {c.action}{c.outcome ? <span style={{ fontWeight: 400, color: '#666' }}> IOT {c.outcome}</span> : ''}
                        <span style={{ fontWeight: 400, color: '#999', marginLeft: 6, fontSize: 9 }}>{c.status}</span>
                      </div>

                      {coaDeps.length > 0 && (
                        <div style={{ fontSize: 9, color: '#888', paddingLeft: 8 }}>
                          {coaDeps.map(d => <div key={d.id}>After: &quot;{d.depends_on_action}&quot; ({d.reason})</div>)}
                        </div>
                      )}

                      {coaRes.length > 0 && (
                        <div style={{ fontSize: 9, color: '#888', paddingLeft: 8 }}>
                          Resources: {coaRes.map(r => `${r.status === 'met' ? '✓' : '○'} ${r.description}`).join('; ')}
                        </div>
                      )}

                      {/* Factors — always expanded, two columns */}
                      {Object.keys(linkedByKind).length > 0 && (
                        <div style={{ paddingLeft: 8, marginTop: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', fontSize: 9, color: '#444' }}>
                          {ALL_FACTOR_KINDS.map(fk => {
                            const kf = linkedByKind[fk.kind]
                            if (!kf?.length) return null
                            return (
                              <div key={fk.kind} style={{ marginBottom: 2 }}>
                                <span style={{ fontWeight: 600, color: '#666' }}>{fk.label}:</span>
                                {kf.map(f => (
                                  <div key={f.id} style={{ paddingLeft: 6, color: f.status === 'resolved' ? '#aaa' : '#444', textDecoration: f.status === 'resolved' ? 'line-through' : 'none' }}>
                                    {f.name}
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {c.has_sub_mission && c.sub_mission_id && (
                        <div style={{ fontSize: 9, color: '#4B82AF', paddingLeft: 8 }}>Sub-mission: {allMissions.find(m => m.id === c.sub_mission_id)?.name ?? c.sub_mission_id}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Unaccounted */}
          {unaccounted.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, color: '#C4504A', margin: '0 0 2px' }}>Unaccounted Factors ({unaccounted.length})</h3>
              {unaccounted.map(f => <div key={f.id} style={{ fontSize: 9, paddingLeft: 8 }}>{f.kind} — {f.name}</div>)}
            </div>
          )}

          {/* Resolved */}
          {resolvedFactors.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, color: '#5A9E6F', margin: '0 0 2px' }}>Resolved Factors</h3>
              {resolvedFactors.map(f => <div key={f.id} style={{ fontSize: 9, paddingLeft: 8, color: '#888' }}>({f.kind}) {f.name}{f.resolution_note ? ` — ${f.resolution_note}` : ''}</div>)}
            </div>
          )}

          {/* Child missions */}
          {childMissions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, margin: '0 0 2px' }}>Child Missions</h3>
              {childMissions.map(cm => (
                <div key={cm.id} style={{ fontSize: 9, paddingLeft: 8 }}>{cm.name} ({cm.status}) — {cm.coa_count ?? 0} COAs, {cm.accounted_factor_count ?? 0}/{cm.factor_count ?? 0} factors</div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  // ============ INTERACTIVE VIEW ============
  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      {/* Nav */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Plan COAs</span>
        <span>|</span>
        <span style={{ color: '#2D2A26', fontWeight: 600 }}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary?print=true`)}>Print version</span>
        {ancestry.length > 0 && (
          <>
            <span>|</span>
            <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${ancestry[ancestry.length - 1].id}/summary`)}>
              Parent: {ancestry[ancestry.length - 1].name}
            </span>
          </>
        )}
      </div>

      {/* 1. Mission name */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2D2A26', margin: '0 0 8px', lineHeight: 1.3 }}>{mission.name}</h1>

      {/* 2. Description */}
      {mission.description && (
        <p style={{ fontSize: 14, color: '#2D2A26', margin: '0 0 16px', lineHeight: 1.6 }}>{mission.description}</p>
      )}

      {/* Subtle health line */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>{allLinked.size}/{factors.filter(f => f.status === 'active').length} factors accounted for</span>
        {untestedAssumptions.length > 0 && <span>{untestedAssumptions.length} assumptions untested</span>}
        {allRes.length > 0 && <span>{metRes.length}/{allRes.length} resources met</span>}
        {mission.big_outcome_name && (
          <span style={{ color: '#5A9E6F', cursor: 'pointer' }} onClick={() => router.push('/map')}>Outcome: {mission.big_outcome_name}</span>
        )}
      </div>

      {/* 3. Intended results */}
      {successFactors.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#C4725A', margin: '0 0 10px' }}>Intended results</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {successFactors.map(f => (
              <div key={f.id} style={{ fontSize: 13, color: '#2D2A26', lineHeight: 1.5, paddingLeft: 16, borderLeft: '3px solid #C4725A30' }}>
                {f.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Intended actions */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', margin: '0 0 12px' }}>Intended actions</h2>

        {HORIZONS.map(h => {
          const sectionCoas = coas.filter(c => c.time_horizon === h.key).sort((a, b) => a.sort_order - b.sort_order)
          if (sectionCoas.length === 0) return null
          return (
            <div key={h.key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: h.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{h.label}</div>
              {sectionCoas.map(c => {
                const coaDeps = dependencies.filter(d => d.coa_id === c.id)
                const coaRes = resources[c.id] ?? []
                const coaLinks = coaFactorLinks[c.id] ?? []
                const hasLinks = coaLinks.length > 0
                const canPromote = hasLinks && c.status === 'proposed' && !c.has_sub_mission && !c.big_outcome_id

                // Group linked factors by kind (excluding successes)
                const linkedByKind: Record<string, Factor[]> = {}
                coaLinks.forEach(l => {
                  const f = factorMap.get(l.factor_id)
                  if (f && f.kind !== 'success') {
                    if (!linkedByKind[f.kind]) linkedByKind[f.kind] = []
                    linkedByKind[f.kind].push(f)
                  }
                })

                return (
                  <div key={c.id} style={{ marginBottom: 8 }}>
                    {/* COA line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #E8E4DC', borderRadius: 8, background: '#FFF' }}>
                      <div style={{ flex: 1, fontSize: 13, color: '#2D2A26' }}>
                        {c.action}{c.outcome ? <><span style={{ color: '#B5B0A8', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, margin: '0 4px' }}>IOT</span>{c.outcome}</> : ''}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.status === 'completed' ? '#5A9E6F' : c.status === 'committed' ? '#C4725A' : '#8A8578' }}>{c.status}</span>
                    </div>

                    {/* Dependencies */}
                    {coaDeps.length > 0 && (
                      <div style={{ paddingLeft: 24, marginTop: 2 }}>
                        {coaDeps.map(d => (
                          <div key={d.id} style={{ fontSize: 10, color: '#8A8578' }}>
                            {d.is_hard ? '⛓' : '→'} After: &quot;{d.depends_on_action}&quot; <span style={{ color: '#B5B0A8' }}>({d.reason})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Resources compact */}
                    {coaRes.length > 0 && (
                      <div style={{ paddingLeft: 24, marginTop: 2, fontSize: 10, color: '#8A8578' }}>
                        Resources: {coaRes.filter(r => r.status === 'met').length}/{coaRes.length} met
                      </div>
                    )}

                    {/* Collapsible factor grid — two columns */}
                    {Object.keys(linkedByKind).length > 0 && (
                      <div style={{ paddingLeft: 24, marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {FACTOR_KINDS_FOR_COAS.map(fk => {
                          const kindFactors = linkedByKind[fk.kind]
                          if (!kindFactors?.length) return null
                          const key = `${c.id}:${fk.kind}`
                          const isOpen = expandedFactors[key]
                          return (
                            <div key={fk.kind}>
                              <div
                                onClick={() => toggleFactorSection(c.id, fk.kind)}
                                style={{ fontSize: 10, fontWeight: 600, color: fk.color, cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <span style={{ fontSize: 8 }}>{isOpen ? '▼' : '▶'}</span>
                                {fk.label} ({kindFactors.length})
                              </div>
                              {isOpen && (
                                <div style={{ paddingLeft: 12 }}>
                                  {kindFactors.map(f => (
                                    <div key={f.id} style={{
                                      fontSize: 10, color: f.status === 'resolved' ? '#B5B0A8' : '#2D2A26',
                                      textDecoration: f.status === 'resolved' ? 'line-through' : 'none',
                                      padding: '1px 0',
                                    }}>{f.name}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Indicators + promote */}
                    <div style={{ paddingLeft: 24, display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                      {c.has_sub_mission && c.sub_mission_id && (
                        <span style={{ fontSize: 10, color: '#4B82AF', cursor: 'pointer' }} onClick={() => router.push(`/plan/${c.sub_mission_id}/summary`)}>Sub-mission →</span>
                      )}
                      {c.big_outcome_id && <span style={{ fontSize: 10, color: '#5A9E6F' }}>On Map</span>}
                      {canPromote && (
                        <div style={{ position: 'relative', display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => handlePromote(c.id, 'hopper')} style={promoteBtn}>Send to hopper</button>
                          <button onClick={() => handlePromote(c.id, 'sub_mission')} style={promoteBtn}>Plan this</button>
                          <button onClick={() => handlePromote(c.id, 'big_outcome')} style={promoteBtn}>Add to Map</button>
                          <ActionToast message={toast?.id === `promote-${c.id}` ? toast.msg : null} visible={visible && toast?.id === `promote-${c.id}`} type={toast?.type} position="above" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Unaccounted factors — collapsible */}
      {unaccounted.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            onClick={() => setShowUnaccounted(!showUnaccounted)}
            style={{ fontSize: 12, fontWeight: 600, color: '#C4504A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ fontSize: 8 }}>{showUnaccounted ? '▼' : '▶'}</span>
            {unaccounted.length} unaccounted factors
          </div>
          {showUnaccounted && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 11, color: '#2D2A26' }}>
              {unaccounted.map(f => <li key={f.id} style={{ marginBottom: 1 }}><span style={{ color: '#8A8578' }}>{f.kind}</span> — {f.name}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Resolved factors */}
      {resolvedFactors.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#5A9E6F', margin: '0 0 6px' }}>Resolved Factors</h3>
          {resolvedFactors.map(f => (
            <div key={f.id} style={{ fontSize: 11, padding: '3px 0', color: '#8A8578' }}>
              <span style={{ fontWeight: 600 }}>({f.kind})</span> {f.name}
              {f.resolution_note && <span> — {f.resolution_note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Child missions */}
      {childMissions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#2D2A26', margin: '0 0 6px' }}>Child Missions</h3>
          {childMissions.map(cm => (
            <div key={cm.id} style={{ padding: '6px 12px', border: '1px solid #E8E4DC', borderRadius: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#2D2A26' }} onClick={() => router.push(`/plan/${cm.id}/summary`)}>{cm.name}</span>
              <span style={{ fontSize: 10, color: '#4B82AF' }}>{cm.status}</span>
              <span style={{ fontSize: 10, color: '#8A8578' }}>{cm.coa_count ?? 0} COAs, {cm.accounted_factor_count ?? 0}/{cm.factor_count ?? 0} factors</span>
            </div>
          ))}
        </div>
      )}

      {/* Mission log */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => setShowLog(!showLog)} style={{ background: 'none', border: '1px solid #E8E4DC', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#8A8578', cursor: 'pointer' }}>
          {showLog ? 'Hide' : 'Show'} mission log ({log.length} entries)
        </button>
        {showLog && (
          <div style={{ marginTop: 8 }}>
            <select value={logFilter} onChange={e => setLogFilter(e.target.value)} style={{ marginBottom: 8, fontSize: 11, border: '1px solid #E8E4DC', borderRadius: 4, padding: '2px 6px' }}>
              <option value="">All types</option>
              {[...new Set(log.map(l => l.entry_type))].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {log.filter(l => !logFilter || l.entry_type === logFilter).map(l => (
                <div key={l.id} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px solid #F0EDE6', color: '#2D2A26' }}>
                  <span style={{ color: '#B5B0A8', fontSize: 10 }}>{new Date(l.created_at).toLocaleString()}</span>
                  <span style={{ marginLeft: 6, color: '#8A8578', fontWeight: 600 }}>[{l.entry_type}]</span>
                  <span style={{ marginLeft: 6 }}>{l.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

const promoteBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #E8E4DC', borderRadius: 4,
  padding: '2px 6px', fontSize: 9, color: '#8A8578', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
}
