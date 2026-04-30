'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Factor, FactorKind } from '@/lib/types'
import { getAuthorColor, formatAuthorTag } from '@/lib/author-colors'
import { useRealtimeMission } from '@/lib/useRealtimeMission'
import { COLORS } from '@/lib/theme'

const KIND_ORDER: FactorKind[] = ['success', 'driver', 'constraint', 'fact', 'assumption']

const KIND_PROMPTS: Record<string, string> = {
  success: 'Envision wild success for:',
  driver: 'List drivers and resources for:',
  constraint: 'List constraints and obstacles for:',
  fact: 'List relevant facts for:',
  assumption: 'List relevant assumptions for:',
}

const INFO_POPUPS: Record<string, string> = {
  success: 'What would wild success look like?\n\nPlace yourself in a future where this mission has succeeded. What do you see? What\'s concrete and real — what metrics have changed, what do people say, what\'s different in daily life? Be specific and vivid. Write the future you would want to stand in.',
  driver: 'What helps this mission succeed?\n\nList anything that works in your favor — money, time, skills, connections, motivation, tools, habits, access, knowledge. If your brother-in-law knows a guy, that\'s a driver. If you have three free weekends, that\'s a driver. If you\'re stubborn and won\'t quit, that\'s a driver. Anything real that helps, put it here.',
  constraint: 'What\'s in the way?\n\nList real obstacles and limitations — not worst-case fantasies, but things that would actually slow you down, stop you, or cause problems. Limited budget, limited time, needing someone\'s permission, missing knowledge or skills, competing priorities. The point isn\'t to be discouraged — it\'s to plan around them. A constraint you\'ve named is a constraint you can handle.',
  fact: 'What do you know for sure?\n\nName things that are true and relevant to this mission — obvious or not. Market conditions, deadlines, who\'s involved, how things work, what\'s already been tried. Include uncomfortable truths too — "my boss won\'t support this" is a fact worth naming. Don\'t be exhaustive — be relevant. If it would change your plan to know it, it belongs here.',
  assumption: 'What are you betting on that you haven\'t proven?\n\nAssumptions are things you believe are true but haven\'t verified. "There\'s demand for this." "I can learn that skill in time." "She\'ll say yes." Your plan depends on these — if they\'re wrong, the plan breaks. Name them so you can test them. An assumption you\'ve identified becomes a task: go find out. Turn assumptions into facts or discard them.',
}

const KIND_COLORS: Record<string, string> = {
  success: COLORS.primary, driver: '#5A9E6F', constraint: '#C4504A', fact: '#4B82AF', assumption: '#9B7EC8',
}

interface Props {
  missionId: string
}

export default function FactorsGuidedPage({ missionId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const kind = (searchParams.get('kind') ?? 'success') as FactorKind
  const [missionName, setMissionName] = useState('')
  const [factors, setFactors] = useState<Factor[]>([])
  const [input, setInput] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/factors?kind=${kind}`).then(r => r.json()),
    ]).then(([missions, facs]) => {
      const m = missions.find((ms: { id: string }) => ms.id === missionId)
      setMissionName(m?.name ?? '')
      setFactors(facs)
      setLoading(false)
    })
  }, [missionId, kind])

  // Real-time: other users' factor changes
  useRealtimeMission(missionId, {
    onFactorChange: (eventType, payload) => {
      const record = (eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>
      if (eventType === 'DELETE') {
        if (record.kind === kind) setFactors(prev => prev.filter(f => f.id !== record.id))
      } else {
        if (record.kind === kind || (payload.new as Record<string, unknown>)?.kind === kind) {
          fetch(`/api/missions/${missionId}/factors?kind=${kind}`).then(r => r.json()).then(data => {
            if (Array.isArray(data)) setFactors(data)
          })
        }
      }
    },
  })

  useEffect(() => { inputRef.current?.focus() }, [kind])

  async function handleAdd() {
    if (!input.trim()) return
    const res = await fetch(`/api/missions/${missionId}/factors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: input.trim() }),
    })
    if (res.ok) {
      const f = await res.json()
      setFactors(prev => [...prev, f])
      setInput('')
      inputRef.current?.focus()
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/missions/${missionId}/factors/${id}`, { method: 'DELETE' })
    if (res.ok) setFactors(prev => prev.filter(f => f.id !== id))
    setDeleteConfirm(null)
  }

  async function moveFactor(id: string, direction: 'up' | 'down') {
    const sorted = [...factors].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(f => f.id === id)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= sorted.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = sorted[idx], b = sorted[swapIdx]
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

  const kindIdx = KIND_ORDER.indexOf(kind)
  const prevKind = kindIdx > 0 ? KIND_ORDER[kindIdx - 1] : null
  const nextKind = kindIdx < KIND_ORDER.length - 1 ? KIND_ORDER[kindIdx + 1] : null
  const color = KIND_COLORS[kind] ?? COLORS.primary

  function goRetreat() {
    if (prevKind) router.push(`/plan/${missionId}/factors?kind=${prevKind}`)
    else router.push(`/plan/${missionId}`)
  }

  function goOnward() {
    if (nextKind) router.push(`/plan/${missionId}/factors?kind=${nextKind}`)
    else router.push(`/plan/${missionId}/coas`)
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  const sorted = [...factors].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700, margin: '0 auto' }}>
      {/* Nav links */}
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 16, display: 'flex', gap: 8 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Plan COAs</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary`)}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', margin: 0 }}>
          {KIND_PROMPTS[kind]} <span style={{ color }}>{missionName}</span>
        </h1>
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          style={{
            background: 'none', border: '1px solid #E8E4DC', borderRadius: '50%',
            width: 20, height: 20, fontSize: 12, color: '#8A8578', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >?</button>
      </div>

      {infoOpen && (
        <div style={{
          background: '#F8F7F4', borderRadius: 8, padding: 14, marginBottom: 16,
          fontSize: 12, color: '#2D2A26', lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>{INFO_POPUPS[kind]}</div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={`Enter ${kind} name`}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC',
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button onClick={handleAdd} style={{
          padding: '8px 16px', background: color, color: '#FFF', border: 'none',
          borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Add to {kind.charAt(0).toUpperCase() + kind.slice(1)}s</button>
      </div>

      {/* Factor list */}
      {sorted.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#B5B0A8', fontSize: 12, fontStyle: 'italic' }}>
          No {kind}s yet. Add some above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {sorted.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 13 }}>
              <button onClick={() => moveFactor(f.id, 'up')} style={arrowBtn}>↑</button>
              <button onClick={() => moveFactor(f.id, 'down')} style={arrowBtn}>↓</button>
              {f.is_own ? (
                deleteConfirm === f.id ? (
                  <span style={{ display: 'inline-flex', gap: 2, background: '#FDF5F4', border: '1px solid #C4504A40', borderRadius: 4, padding: '1px 4px' }}>
                    <button onClick={() => handleDelete(f.id)} style={{ ...arrowBtn, color: '#C4504A', fontSize: 10, fontWeight: 700 }}>yes</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ ...arrowBtn, fontSize: 10 }}>no</button>
                  </span>
                ) : (
                  <button onClick={() => setDeleteConfirm(f.id)} style={{ ...arrowBtn, color: '#C4504A' }}>del</button>
                )
              ) : <span style={{ width: 14 }} />}
              <span style={{ color: getAuthorColor(f.user_id, !!f.is_own), fontWeight: 600, fontSize: 12 }}>{formatAuthorTag(f.author_name, f.is_own)}</span>
              <span style={{ color: '#2D2A26' }}>{f.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E8E4DC', paddingTop: 16 }}>
        <button onClick={goRetreat} style={navBtn}>← Retreat!</button>
        <button onClick={goOnward} style={{ ...navBtn, background: color, color: '#FFF', border: `1px solid ${color}` }}>
          Onward! →
        </button>
      </div>
    </div>
  )
}

const arrowBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#B5B0A8', cursor: 'pointer', width: 16, textAlign: 'center',
}

const navBtn: React.CSSProperties = {
  padding: '8px 20px', background: '#F8F7F4', border: '1px solid #E8E4DC',
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#2D2A26',
}
