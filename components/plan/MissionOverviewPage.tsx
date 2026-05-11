'use client'
import { useState, useEffect } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Mission, Factor, FactorKind, COA } from '@/lib/types'
import { getAuthorColor, formatAuthorTag } from '@/lib/author-colors'
import { useRealtimeMission } from '@/lib/useRealtimeMission'
import { COLORS } from '@/lib/theme'

const FACTOR_KINDS: { kind: FactorKind; label: string; color: string }[] = [
  { kind: 'success', label: 'Signs and visions of wild success', color: COLORS.primary },
  { kind: 'driver', label: 'Resources and drivers of success', color: '#5A9E6F' },
  { kind: 'constraint', label: 'Constraints and obstacles to success', color: '#C4504A' },
  { kind: 'fact', label: 'Facts', color: '#4B82AF' },
  { kind: 'assumption', label: 'Assumptions', color: '#9B7EC8' },
]

const INFO_POPUPS: Record<string, string> = {
  success: 'What would wild success look like?\n\nPlace yourself in a future where this mission has succeeded. What do you see? What\'s concrete and real — what metrics have changed, what do people say, what\'s different in daily life? Be specific and vivid. Write the future you would want to stand in.',
  driver: 'What helps this mission succeed?\n\nList anything that works in your favor — money, time, skills, connections, motivation, tools, habits, access, knowledge. If your brother-in-law knows a guy, that\'s a driver. If you have three free weekends, that\'s a driver. If you\'re stubborn and won\'t quit, that\'s a driver. Anything real that helps, put it here.',
  constraint: 'What\'s in the way?\n\nList real obstacles and limitations — not worst-case fantasies, but things that would actually slow you down, stop you, or cause problems. Limited budget, limited time, needing someone\'s permission, missing knowledge or skills, competing priorities. The point isn\'t to be discouraged — it\'s to plan around them. A constraint you\'ve named is a constraint you can handle.',
  fact: 'What do you know for sure?\n\nName things that are true and relevant to this mission — obvious or not. Market conditions, deadlines, who\'s involved, how things work, what\'s already been tried. Include uncomfortable truths too — "my boss won\'t support this" is a fact worth naming. Don\'t be exhaustive — be relevant. If it would change your plan to know it, it belongs here.',
  assumption: 'What are you betting on that you haven\'t proven?\n\nAssumptions are things you believe are true but haven\'t verified. "There\'s demand for this." "I can learn that skill in time." "She\'ll say yes." Your plan depends on these — if they\'re wrong, the plan breaks. Name them so you can test them. An assumption you\'ve identified becomes a task: go find out. Turn assumptions into facts or discard them.',
}

interface Props {
  missionId: string
}

export default function MissionOverviewPage({ missionId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mission, setMission] = useState<Mission | null>(null)
  const [allMissions, setAllMissions] = useState<Mission[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [infoOpen, setInfoOpen] = useState<string | null>(null)
  const [coas, setCoas] = useState<COA[]>([])
  const [coaActionInput, setCoaActionInput] = useState('')
  const [coaOutcomeInput, setCoaOutcomeInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [collaborators, setCollaborators] = useState<{ user_id: string; role: string; name: string }[]>([])
  const { toast, visible, show } = useActionToast()

  async function handleRename() {
    const trimmed = nameDraft.trim()
    if (!trimmed || !mission) { setEditingName(false); return }
    const res = await fetch(`/api/missions/${missionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (res.ok) {
      setMission({ ...mission, name: trimmed })
      show('rename', `Mission renamed to "${trimmed}"`)
    }
    setEditingName(false)
  }

  async function handleDescSave() {
    const trimmed = descDraft.trim()
    if (!mission) { setEditingDesc(false); return }
    const res = await fetch(`/api/missions/${missionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: trimmed || null }),
    })
    if (res.ok) {
      setMission({ ...mission, description: trimmed || null })
      show('desc', 'Description updated')
    }
    setEditingDesc(false)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/missions`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/factors`).then(r => r.json()),
      fetch(`/api/missions/${missionId}/coas`).then(r => r.json()),
    ]).then(async ([missions, facs, coaData]) => {
      const all = Array.isArray(missions) ? missions : []
      setAllMissions(all)
      const m = all.find((ms: Mission) => ms.id === missionId)
      setMission(m ?? null)
      setFactors(Array.isArray(facs) ? facs : [])
      setCoas(Array.isArray(coaData) ? coaData : [])

      // Build collaborators from factor authors + fetch all participants via user search
      const authorMap = new Map<string, string>()
      for (const f of (Array.isArray(facs) ? facs : [])) {
        if (f.user_id && (f.author_full_name || f.author_name)) authorMap.set(f.user_id, f.author_full_name || f.author_name)
      }

      // Fetch invitations to get all accepted collaborators with emails
      try {
        const invRes = await fetch(`/api/missions/${missionId}/invitations`)
        const invitations = invRes.ok ? await invRes.json() : []
        for (const inv of (Array.isArray(invitations) ? invitations : [])) {
          if (inv.status === 'accepted' && inv.email) {
            if (!authorMap.has(inv.email)) {
              // We don't have user_id from invitations, so just note the email
            }
          }
        }
      } catch { /* invitations fetch failed — non-critical */ }

      // Also get names from the factors API for any participants who contributed
      // For participants who haven't added factors, use a direct lookup
      try {
        const participantRes = await fetch(`/api/missions/${missionId}/commitments`)
        const commitments = participantRes.ok ? await participantRes.json() : []
        for (const c of (Array.isArray(commitments) ? commitments : [])) {
          if (c.user_id && c.user_name && !authorMap.has(c.user_id)) {
            authorMap.set(c.user_id, c.user_name)
          }
        }
      } catch { /* commitments fetch failed — non-critical */ }

      const collabs = [...authorMap.entries()].map(([uid, name]) => ({ user_id: uid, role: 'collaborator', name }))
      setCollaborators(collabs)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [missionId])

  // Auto-enter edit mode when linked from "Edit mission" menu
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && mission && !editingName) {
      setEditingName(true)
      setNameDraft(mission.name)
    }
  }, [mission, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: other users' factor changes appear live
  useRealtimeMission(missionId, {
    onFactorChange: (eventType, payload) => {
      if (eventType === 'DELETE') {
        const old = payload.old as Record<string, unknown>
        setFactors(prev => prev.filter(f => f.id !== old.id))
      } else {
        fetch(`/api/missions/${missionId}/factors`).then(r => r.json()).then(data => {
          if (Array.isArray(data)) setFactors(data)
        }).catch(() => {})
      }
    },
    onCoaChange: (eventType, payload) => {
      if (eventType === 'DELETE') {
        const old = payload.old as Record<string, unknown>
        setCoas(prev => prev.filter(c => c.id !== old.id))
      } else {
        fetch(`/api/missions/${missionId}/coas`).then(r => r.json()).then(data => {
          if (Array.isArray(data)) setCoas(data)
        }).catch(() => {})
      }
    },
  })

  async function addFactor(kind: FactorKind) {
    const text = inputs[kind]?.trim()
    if (!text) return
    const res = await fetch(`/api/missions/${missionId}/factors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: text }),
    })
    if (res.ok) {
      const f = await res.json()
      setFactors(prev => [...prev, f])
      setInputs(prev => ({ ...prev, [kind]: '' }))
      // Update mission counts
      setMission(prev => prev ? { ...prev, factor_count: (prev.factor_count ?? 0) + 1 } : prev)
    }
  }

  async function deleteFactor(id: string) {
    const res = await fetch(`/api/missions/${missionId}/factors/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFactors(prev => prev.filter(f => f.id !== id))
      setMission(prev => prev ? { ...prev, factor_count: Math.max(0, (prev.factor_count ?? 1) - 1) } : prev)
      show('factor-del', 'Factor deleted')
    }
  }

  async function editFactor(id: string, name: string) {
    const res = await fetch(`/api/missions/${missionId}/factors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setFactors(prev => prev.map(f => f.id === id ? { ...f, name } : f))
    }
  }

  async function moveFactor(id: string, direction: 'up' | 'down', kind: FactorKind) {
    const kindFactors = factors.filter(f => f.kind === kind).sort((a, b) => a.sort_order - b.sort_order)
    const idx = kindFactors.findIndex(f => f.id === id)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= kindFactors.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = kindFactors[idx], b = kindFactors[swapIdx]
    await Promise.all([
      fetch(`/api/missions/${missionId}/factors/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/missions/${missionId}/factors/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
    setFactors(prev => prev.map(f => {
      if (f.id === a.id) return { ...f, sort_order: b.sort_order }
      if (f.id === b.id) return { ...f, sort_order: a.sort_order }
      return f
    }))
  }

  async function addCoa() {
    if (!coaActionInput.trim()) return
    const res = await fetch(`/api/missions/${missionId}/coas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: coaActionInput.trim(), outcome: coaOutcomeInput.trim() || null }),
    })
    if (res.ok) {
      const c = await res.json()
      setCoas(prev => [...prev, c])
      setCoaActionInput('')
      setCoaOutcomeInput('')
    }
  }

  async function deleteCoa(id: string) {
    const res = await fetch(`/api/missions/${missionId}/coas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoas(prev => prev.filter(c => c.id !== id))
      show('coa-del', 'COA deleted')
    }
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>
  if (!mission) return <div style={{ padding: 40, color: '#C4504A', fontSize: 13 }}>Mission not found</div>

  const factorCount = factors.length
  const accountedCount = factors.filter(f => (f.link_count ?? 0) > 0).length
  const pct = factorCount > 0 ? Math.round((accountedCount / factorCount) * 100) : 0

  // Build ancestry: walk up parent_mission_id chain
  const ancestry: { id: string; name: string; coaName?: string | null }[] = []
  let current: Mission | undefined = mission
  while (current?.parent_mission_id) {
    const parent = allMissions.find(m => m.id === current!.parent_mission_id)
    if (!parent) break
    ancestry.unshift({ id: parent.id, name: parent.name, coaName: current.parent_coa_name })
    current = parent
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 4, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push('/plan')}>Plan</span>
        {ancestry.map(a => (
          <span key={a.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span>→</span>
            <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${a.id}`)}>{a.name}</span>
            {a.coaName && <span style={{ fontStyle: 'italic', color: '#B5B0A8' }}>&quot;{a.coaName}&quot;</span>}
          </span>
        ))}
        <span>→</span>
        <span style={{ color: '#2D2A26', fontWeight: 600 }}>{mission.name}</span>
      </div>
      {/* Nav */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 12, display: 'flex', gap: 8 }}>
        <span style={{ color: '#2D2A26', fontWeight: 600 }}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Plan COAs</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary`)}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ width: 240, flexShrink: 0 }}>
          {/* Closure banner for closed missions */}
          {CLOSED_STATUSES.includes(mission.status) && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = mission as any
            const closureType: string | null = m.closure_type ?? null
            const closedAt: string | null = m.closed_at ?? null
            const closureNote: string | null = m.closure_note ?? null
            return (
              <div style={{ marginBottom: 16, padding: '10px 12px', background: '#F4FDF7', border: '1px solid #5A9E6F40', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#5A9E6F', marginBottom: 4 }}>Mission closed</div>
                {closureType && (
                  <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 2 }}>
                    {CLOSURE_LABELS[closureType] ?? closureType}
                  </div>
                )}
                {closedAt && (
                  <div style={{ fontSize: 10, color: '#B5B0A8' }}>
                    {new Date(closedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                {closureNote && (
                  <div style={{ fontSize: 11, color: '#8A8578', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                    {closureNote}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Name — read-only when closed */}
          {!CLOSED_STATUSES.includes(mission.status) && editingName ? (
            <textarea
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRename() } if (e.key === 'Escape') setEditingName(false) }}
              onBlur={() => handleRename()}
              autoFocus rows={3}
              style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 8px', border: `1px solid ${COLORS.primary}`, borderRadius: 4, padding: '4px 6px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'none', lineHeight: 1.3 }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px', position: 'relative' }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: 0 }}>{mission.name}</h1>
              {!CLOSED_STATUSES.includes(mission.status) && (
                <button onClick={() => { setEditingName(true); setNameDraft(mission.name) }} title="Rename mission"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: '#B5B0A8', lineHeight: 1 }}>✎</button>
              )}
              <ActionToast message={toast?.id === 'rename' ? toast.msg : null} visible={visible && toast?.id === 'rename'} position="below" width={180} />
            </div>
          )}

          {/* Description — read-only when closed */}
          {!CLOSED_STATUSES.includes(mission.status) && editingDesc ? (
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDescSave() } if (e.key === 'Escape') setEditingDesc(false) }}
              onBlur={() => handleDescSave()}
              autoFocus rows={3}
              style={{ fontSize: 12, color: '#8A8578', margin: '0 0 12px', lineHeight: 1.5, width: '100%', border: `1px solid ${COLORS.primary}`, borderRadius: 4, padding: '4px 6px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '0 0 12px', position: 'relative' }}>
              <p style={{ fontSize: 12, color: '#8A8578', margin: 0, lineHeight: 1.5, flex: 1 }}>
                {mission.description || <span style={{ fontStyle: 'italic', color: '#B5B0A8' }}>No description</span>}
              </p>
              {!CLOSED_STATUSES.includes(mission.status) && (
                <button onClick={() => { setEditingDesc(true); setDescDraft(mission.description ?? '') }} title="Edit description"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#B5B0A8', lineHeight: 1, flexShrink: 0 }}>✎</button>
              )}
              <ActionToast message={toast?.id === 'desc' ? toast.msg : null} visible={visible && toast?.id === 'desc'} position="below" width={160} />
            </div>
          )}
          <div style={{ fontSize: 11, color: STATUS_COLORS[mission.status], fontWeight: 600, marginBottom: 12 }}>
            {mission.status}
          </div>
          {mission.big_outcome_name && (
            <div style={{ fontSize: 11, color: '#5A9E6F', marginBottom: 8 }}>
              Outcome: <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push('/map')}>{mission.big_outcome_name}</span>
            </div>
          )}

          {collaborators.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 11 }}>
              <div style={{ color: '#2D2A26', fontWeight: 600, marginBottom: 4 }}>Collaborators</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collaborators.map(c => (
                  <span key={c.user_id} style={{ color: getAuthorColor(c.user_id, false), fontWeight: 600, fontSize: 11 }}>{c.name}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#F8F7F4', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
            <div style={{ color: '#2D2A26', fontWeight: 600, marginBottom: 6 }}>Planning Stats</div>
            <div style={{ color: '#8A8578' }}>{mission.coa_count ?? 0} courses of action</div>
            <div style={{ color: '#8A8578' }}>{factorCount} factors total</div>
            <div style={{ color: '#5A9E6F' }}>{accountedCount} accounted for</div>
            <div style={{ color: accountedCount < factorCount ? '#C4504A' : '#5A9E6F' }}>
              {factorCount - accountedCount} unaccounted
            </div>
            <div style={{ color: '#2D2A26', fontWeight: 600, marginTop: 6 }}>
              Factors are {pct}% matched to actions.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CLOSED_STATUSES.includes(mission.status) ? (
              <>
                <button onClick={() => router.push(`/plan/${missionId}/close`)} style={{ ...navLinkStyle, color: '#5A9E6F' }}>
                  View closure summary
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/summary`)} style={navLinkStyle}>
                  View plan summary
                </button>
                <button onClick={async () => {
                  await fetch(`/api/missions/${missionId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'active', closure_type: null, closure_note: null, closed_at: null, closed_by: null }),
                  })
                  window.location.reload()
                }} style={{ ...navLinkStyle, color: '#B5B0A8', marginTop: 8, fontSize: 10 }}>
                  Reopen mission
                </button>
              </>
            ) : (
              <>
                <button onClick={() => router.push(`/plan/${missionId}/factors?kind=success`)} style={navLinkStyle}>
                  Step by step planning
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/coas`)} style={navLinkStyle}>
                  Plan courses of action
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/arrange`)} style={navLinkStyle}>
                  Engage mission
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/summary`)} style={navLinkStyle}>
                  See plan summary
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/commitments`)} style={navLinkStyle}>
                  Commitments
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/invite`)} style={navLinkStyle}>
                  Invite collaborators
                </button>
                <button onClick={() => router.push(`/plan/${missionId}/close`)}
                  style={{ ...navLinkStyle, color: '#8A857D', marginTop: 8 }}>
                  Close this mission
                </button>
              </>
            )}
          </div>
        </div>

        {/* Factor Grid */}
        <div style={{ flex: 1 }}>
          {/* Success (full width top) */}
          <FactorCard
            kind="success"
            factors={factors}
            input={inputs.success ?? ''}
            onInput={v => setInputs(p => ({ ...p, success: v }))}
            onAdd={() => addFactor('success')}
            onDelete={deleteFactor}
            onEdit={editFactor}
            onMove={moveFactor}
            infoOpen={infoOpen === 'success'}
            onToggleInfo={() => setInfoOpen(infoOpen === 'success' ? null : 'success')}
          />
          {/* 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {(['driver', 'constraint', 'fact', 'assumption'] as FactorKind[]).map(kind => (
              <FactorCard
                key={kind}
                kind={kind}
                factors={factors}
                input={inputs[kind] ?? ''}
                onInput={v => setInputs(p => ({ ...p, [kind]: v }))}
                onAdd={() => addFactor(kind)}
                onDelete={deleteFactor}
                onEdit={editFactor}
                onMove={moveFactor}
                infoOpen={infoOpen === kind}
                onToggleInfo={() => setInfoOpen(infoOpen === kind ? null : kind)}
              />
            ))}
          </div>

          {/* COA box — mirrors the success box at top */}
          <div style={{ border: '1px solid #E8E4DC', borderRadius: 8, padding: 12, background: '#FFF', marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2A26', marginBottom: 8 }}>Courses of action</div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <input
                value={coaActionInput}
                onChange={e => setCoaActionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCoa() }}
                placeholder="Do what?"
                style={{ flex: 55, padding: '5px 8px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#B5B0A8', letterSpacing: 1 }}>IOT</span>
              <input
                value={coaOutcomeInput}
                onChange={e => setCoaOutcomeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCoa() }}
                placeholder="Achieve what?"
                style={{ flex: 35, padding: '5px 8px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={addCoa} style={{
                padding: '5px 10px', background: '#2D2A2615', border: '1px solid #E8E4DC',
                borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#2D2A26', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Add</button>
            </div>

            {coas.length === 0 ? (
              <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>No courses of action yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {coas.sort((a, b) => a.sort_order - b.sort_order).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: getAuthorColor(c.user_id, !!c.is_own), fontWeight: 600, fontSize: 11 }}>
                      {formatAuthorTag(c.author_name, c.is_own)}
                    </span>
                    <span style={{ color: '#2D2A26', flex: 1 }}>
                      {c.action}{c.outcome ? <span style={{ color: '#B5B0A8', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, margin: '0 4px' }}>IOT</span> : ''}{c.outcome ?? ''}
                    </span>
                    <span style={{ color: '#C4504A', fontSize: 10, flexShrink: 0 }}>♥ {c.linked_factor_count ?? 0}</span>
                    {c.is_own && (
                      <button onClick={() => deleteCoa(c.id)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: '#C4504A', cursor: 'pointer' }}>del</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  planning: '#4B82AF', active: '#5A9E6F', completed: '#8A8578', abandoned: '#C4504A', shelved: '#8A857D', superseded: COLORS.primary,
}

const CLOSED_STATUSES = ['completed', 'abandoned', 'shelved', 'superseded']

const CLOSURE_LABELS: Record<string, string> = {
  accomplished: 'Accomplished', partially_accomplished: 'Partially accomplished',
  shelved: 'Shelved', superseded: 'Superseded', abandoned: 'Abandoned',
}

const navLinkStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #E8E4DC', borderRadius: 6, padding: '6px 12px',
  fontSize: 11, color: COLORS.primary, cursor: 'pointer', fontWeight: 600, textAlign: 'left',
}

function FactorCard({
  kind, factors, input, onInput, onAdd, onDelete, onEdit, onMove, infoOpen, onToggleInfo,
}: {
  kind: FactorKind
  factors: Factor[]
  input: string
  onInput: (v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onEdit: (id: string, name: string) => void
  onMove: (id: string, dir: 'up' | 'down', kind: FactorKind) => void
  infoOpen: boolean
  onToggleInfo: () => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const meta = FACTOR_KINDS.find(f => f.kind === kind)!
  const items = factors.filter(f => f.kind === kind).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ border: '1px solid #E8E4DC', borderRadius: 8, padding: 12, background: '#FFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        <button
          onClick={onToggleInfo}
          style={{
            background: 'none', border: '1px solid #E8E4DC', borderRadius: '50%',
            width: 16, height: 16, fontSize: 10, color: '#8A8578', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0,
          }}
        >?</button>
      </div>

      {infoOpen && (
        <div style={{
          background: '#F8F7F4', borderRadius: 6, padding: 10, marginBottom: 8,
          fontSize: 11, color: '#2D2A26', lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>{INFO_POPUPS[kind]}</div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
          placeholder={`Enter ${kind} name`}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #E8E4DC',
            fontSize: 12, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onAdd}
          style={{
            padding: '5px 10px', background: meta.color + '20', border: `1px solid ${meta.color}40`,
            borderRadius: 4, fontSize: 10, fontWeight: 600, color: meta.color, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >Add</button>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: '#B5B0A8', fontStyle: 'italic' }}>No {kind}s yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <button onClick={() => onMove(f.id, 'up', kind)} style={arrowBtnStyle}>↑</button>
              <button onClick={() => onMove(f.id, 'down', kind)} style={arrowBtnStyle}>↓</button>
              {f.is_own ? (
                confirmId === f.id ? (
                  <span style={{ display: 'inline-flex', gap: 2, background: '#FDF5F4', border: '1px solid #C4504A40', borderRadius: 4, padding: '1px 4px' }}>
                    <button onClick={() => { onDelete(f.id); setConfirmId(null) }} style={{ ...arrowBtnStyle, color: '#C4504A', fontSize: 10, fontWeight: 700 }}>yes</button>
                    <button onClick={() => setConfirmId(null)} style={{ ...arrowBtnStyle, fontSize: 10 }}>no</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(f.id)} style={{ ...arrowBtnStyle, color: '#C4504A' }}>del</button>
                )
              ) : <span style={{ width: 14 }} />}
              <span style={{ color: getAuthorColor(f.user_id, !!f.is_own), fontWeight: 600, fontSize: 11 }}>{formatAuthorTag(f.author_name, f.is_own)}</span>
              {editingId === f.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { if (editText.trim() && editText.trim() !== f.name) onEdit(f.id, editText.trim()); setEditingId(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { if (editText.trim() && editText.trim() !== f.name) onEdit(f.id, editText.trim()); setEditingId(null) }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={{ flex: 1, fontSize: 12, padding: '1px 4px', border: '1px solid #E8E4DC', borderRadius: 3, outline: 'none', fontFamily: 'inherit' }}
                />
              ) : (
                <span
                  onClick={f.is_own ? () => { setEditingId(f.id); setEditText(f.name) } : undefined}
                  style={{ color: '#2D2A26', cursor: f.is_own ? 'text' : 'default' }}
                >{f.name}</span>
              )}
              {(f.link_count ?? 0) > 0 && editingId !== f.id && (
                <span style={{ color: '#C4504A', fontSize: 10, marginLeft: 'auto' }}>♥ {f.link_count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const arrowBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 10, color: '#B5B0A8',
  cursor: 'pointer', width: 14, textAlign: 'center',
}
