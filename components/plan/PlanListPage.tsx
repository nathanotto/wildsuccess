'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Mission } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  planning: '#4B82AF',
  active: '#5A9E6F',
  completed: '#8A8578',
  abandoned: '#C4504A',
  shelved: '#8A857D',
  superseded: '#C4725A',
}

const STATUS_CYCLE = ['planning', 'active'] as const
const CLOSED_STATUSES = ['completed', 'abandoned', 'shelved', 'superseded']

export default function PlanListPage() {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
  }

  useEffect(() => {
    fetch('/api/missions').then(r => r.json()).then(data => {
      setMissions(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/missions/${id}`, { method: 'DELETE' })
    if (res.ok) { setMissions(prev => prev.filter(m => m.id !== id)); showToast('Mission deleted') }
    setDeleteConfirm(null); setMenuOpen(null)
  }

  async function togglePin(id: string) {
    const m = missions.find(x => x.id === id)
    if (!m) return
    const newVal = !m.is_pinned
    await fetch(`/api/missions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: newVal }),
    })
    setMissions(prev => prev.map(x => x.id === id ? { ...x, is_pinned: newVal } : x))
  }

  async function cycleStatus(id: string) {
    const m = missions.find(x => x.id === id)
    if (!m || CLOSED_STATUSES.includes(m.status)) return
    const idx = STATUS_CYCLE.indexOf(m.status as typeof STATUS_CYCLE[number])
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    await fetch(`/api/missions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setMissions(prev => prev.map(x => x.id === id ? { ...x, status: next } : x))
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading missions…</div>

  // Build tree
  const childrenOf = (parentId: string) => missions.filter(m => m.parent_mission_id === parentId)
  const topLevel = missions.filter(m => !m.parent_coa_id)
  const nestedIds = new Set<string>()
  function collectNestedIds(parentId: string) {
    childrenOf(parentId).forEach(c => { nestedIds.add(c.id); collectNestedIds(c.id) })
  }
  topLevel.forEach(m => collectNestedIds(m.id))
  const orphans = missions.filter(m => m.parent_coa_id && !nestedIds.has(m.id))

  // Sort: pinned first, then by updated_at descending, then by name
  function sortMissions(arr: Mission[]): Mission[] {
    return [...arr].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      // By recency (updated_at)
      const aDate = a.updated_at ?? a.created_at
      const bDate = b.updated_at ?? b.created_at
      if (aDate && bDate) return bDate.localeCompare(aDate)
      return a.name.localeCompare(b.name)
    })
  }

  function renderMission(m: Mission, depth: number) {
    const pct = m.factor_count ? Math.round(((m.accounted_factor_count ?? 0) / m.factor_count) * 100) : 0
    const isChild = depth > 0
    const children = childrenOf(m.id)
    const isClosed = CLOSED_STATUSES.includes(m.status)
    const isMenuOpen = menuOpen === m.id

    return (
      <div key={m.id}>
        <div style={{
          marginLeft: depth * 24,
          ...(isChild ? { borderLeft: '2px solid #C4725A40', paddingLeft: 12 } : {}),
        }}>
          <div style={{
            padding: '10px 16px', border: '1px solid #E8E4DC', borderRadius: 8,
            background: m.is_pinned ? '#FFFDF8' : '#FFF',
            borderLeft: m.is_pinned ? '3px solid #C4725A' : undefined,
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6,
            opacity: isClosed ? 0.6 : 1,
          }}>
            {/* Pin star */}
            {!isChild && (
              <span
                onClick={() => togglePin(m.id)}
                title={m.is_pinned ? 'Unpin' : 'Pin to top'}
                style={{ cursor: 'pointer', fontSize: 14, color: m.is_pinned ? '#C4725A' : '#E0DDD6', flexShrink: 0, paddingTop: 2 }}
              >
                {m.is_pinned ? '★' : '☆'}
              </span>
            )}

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                {isChild && <span style={{ color: '#C4725A', fontSize: 12 }}>↳</span>}
                <span
                  onClick={() => router.push(`/plan/${m.id}`)}
                  style={{ fontSize: isChild ? 13 : 15, fontWeight: 600, color: '#2D2A26', cursor: 'pointer' }}
                >{m.name}</span>
                <span
                  onClick={() => !isClosed && cycleStatus(m.id)}
                  title={isClosed ? m.status : 'Click to change status'}
                  style={{
                    fontSize: 9, fontWeight: 600, color: STATUS_COLORS[m.status] ?? '#8A8578',
                    background: (STATUS_COLORS[m.status] ?? '#8A8578') + '15',
                    padding: '1px 6px', borderRadius: 4,
                    cursor: isClosed ? 'default' : 'pointer',
                  }}
                >{m.status}</span>
              </div>
              {m.description && (
                <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{m.description}</div>
              )}
              <div style={{ fontSize: 10, color: '#B5B0A8', display: 'flex', gap: 10 }}>
                {(m.factor_count ?? 0) > 0 && <span>{m.factor_count} factors · {pct}%</span>}
                {(m.coa_count ?? 0) > 0 && <span>{m.coa_count} COAs</span>}
                {m.big_outcome_name && <span style={{ color: '#5A9E6F' }}>{m.big_outcome_name}</span>}
              </div>
              {isChild && m.parent_coa_name && (
                <div style={{ fontSize: 9, color: '#B5B0A8', marginTop: 2, fontStyle: 'italic' }}>from: &quot;{m.parent_coa_name}&quot;</div>
              )}
            </div>

            {/* Menu */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setMenuOpen(isMenuOpen ? null : m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#B5B0A8', padding: '0 4px', lineHeight: 1 }}
              >···</button>
              {isMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 24, background: '#FFF', border: '1px solid #E8E4DC',
                  borderRadius: 6, padding: '4px 0', minWidth: 130, zIndex: 20, boxShadow: '0 4px 16px #2D2A2610',
                }}>
                  <button onClick={() => { router.push(`/plan/${m.id}/factors?kind=success`); setMenuOpen(null) }} style={menuItemStyle}>Plan</button>
                  <button onClick={() => { router.push(`/plan/${m.id}`); setMenuOpen(null) }} style={menuItemStyle}>Overview</button>
                  <button onClick={() => { router.push(`/plan/${m.id}/coas`); setMenuOpen(null) }} style={menuItemStyle}>COAs</button>
                  <button onClick={() => { router.push(`/plan/${m.id}/arrange`); setMenuOpen(null) }} style={menuItemStyle}>Arrange</button>
                  <button onClick={() => { router.push(`/plan/${m.id}/commitments`); setMenuOpen(null) }} style={menuItemStyle}>Commitments</button>
                  <div style={{ height: 1, background: '#F0EDE6', margin: '2px 0' }} />
                  {!isClosed && (
                    <button onClick={() => { router.push(`/plan/${m.id}/close`); setMenuOpen(null) }} style={menuItemStyle}>Close mission</button>
                  )}
                  {deleteConfirm === m.id ? (
                    <div style={{ padding: '4px 14px', display: 'flex', gap: 8 }}>
                      <button onClick={() => handleDelete(m.id)} style={{ ...menuItemStyle, color: '#C4504A', padding: '2px 0' }}>Confirm delete</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ ...menuItemStyle, padding: '2px 0' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(m.id)} style={{ ...menuItemStyle, color: '#C4504A' }}>Delete</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {children.map(child => renderMission(child, depth + 1))}
      </div>
    )
  }

  const activeMissions = sortMissions([
    ...topLevel.filter(m => !CLOSED_STATUSES.includes(m.status)),
    ...orphans.filter(m => !CLOSED_STATUSES.includes(m.status)),
  ])
  const closedMissions = [
    ...topLevel.filter(m => CLOSED_STATUSES.includes(m.status)),
    ...orphans.filter(m => CLOSED_STATUSES.includes(m.status)),
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }} onClick={() => { if (menuOpen) setMenuOpen(null) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', margin: 0 }}>Missions</h1>
        <button
          onClick={() => router.push('/plan/new')}
          style={{ padding: '6px 16px', background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >+ New mission</button>
      </div>

      {missions.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8A8578', fontSize: 13 }}>
          No missions yet. Create one to start planning.
        </div>
      ) : (
        <>
          <div>
            {activeMissions.map(m => renderMission(m, 0))}
          </div>

          {closedMissions.length > 0 && (
            <details style={{ marginTop: 24 }}>
              <summary style={{ fontSize: 12, color: '#8A857D', cursor: 'pointer', marginBottom: 8, fontWeight: 600 }}>
                Closed missions ({closedMissions.length})
              </summary>
              {closedMissions.map(m => renderMission(m, 0))}
            </details>
          )}
        </>
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

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 14px', fontSize: 12, color: '#2D2A26',
  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
}
