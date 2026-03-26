'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Mission } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  planning: '#4B82AF',
  active: '#5A9E6F',
  completed: '#8A8578',
  abandoned: '#C4504A',
}

export default function PlanListPage() {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setToastVisible(true)
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
    if (res.ok) {
      setMissions(prev => prev.filter(m => m.id !== id))
      showToast('Mission deleted')
    }
    setDeleteConfirm(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading missions…</div>

  // Build tree: top-level = no parent_coa_id, children grouped by parent_mission_id
  const childrenOf = (parentId: string) =>
    missions.filter(m => m.parent_mission_id === parentId)

  const topLevel = missions.filter(m => !m.parent_coa_id)
  // Orphans: have parent_coa_id but parent_mission_id doesn't match any mission we have
  const nestedIds = new Set<string>()
  function collectNestedIds(parentId: string) {
    childrenOf(parentId).forEach(c => { nestedIds.add(c.id); collectNestedIds(c.id) })
  }
  topLevel.forEach(m => collectNestedIds(m.id))
  const orphans = missions.filter(m => m.parent_coa_id && !nestedIds.has(m.id))

  function renderMission(m: Mission, depth: number) {
    const pct = m.factor_count ? Math.round(((m.accounted_factor_count ?? 0) / m.factor_count) * 100) : 0
    const isChild = depth > 0
    const children = childrenOf(m.id)

    return (
      <div key={m.id}>
        <div style={{
          marginLeft: depth * 24,
          ...(isChild ? { borderLeft: '2px solid #C4725A40', paddingLeft: 12 } : {}),
        }}>
          <div style={{
            padding: '10px 16px', border: '1px solid #E8E4DC', borderRadius: 8, background: '#FFF',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {isChild && <span style={{ color: '#C4725A', fontSize: 12 }}>↳</span>}
                <span
                  onClick={() => router.push(`/plan/${m.id}`)}
                  style={{ fontSize: isChild ? 13 : 14, fontWeight: 600, color: '#2D2A26', cursor: 'pointer' }}
                >{m.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: STATUS_COLORS[m.status] ?? '#8A8578',
                  background: (STATUS_COLORS[m.status] ?? '#8A8578') + '15',
                  padding: '1px 6px', borderRadius: 4,
                }}>{m.status}</span>
              </div>
              {m.description && (
                <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 2, lineHeight: 1.4 }}>{m.description}</div>
              )}
              <div style={{ fontSize: 11, color: '#8A8578', display: 'flex', gap: 12 }}>
                <span>{m.factor_count ?? 0} factors, {pct}% accounted</span>
                <span>{m.coa_count ?? 0} COAs</span>
                {m.big_outcome_name && <span style={{ color: '#5A9E6F' }}>Outcome: {m.big_outcome_name}</span>}
              </div>
              {isChild && m.parent_coa_name && (
                <div style={{ fontSize: 10, color: '#8A8578', marginTop: 2, fontStyle: 'italic' }}>
                  from: &quot;{m.parent_coa_name}&quot;
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => router.push(`/plan/${m.id}/factors?kind=success`)} style={linkBtnStyle}>Plan</button>
              <button onClick={() => router.push(`/plan/${m.id}`)} style={linkBtnStyle}>Overview</button>
              <button onClick={() => router.push(`/plan/${m.id}/coas`)} style={linkBtnStyle}>COAs</button>
              {deleteConfirm === m.id ? (
                <>
                  <button onClick={() => handleDelete(m.id)} style={{ ...linkBtnStyle, color: '#C4504A' }}>Confirm</button>
                  <button onClick={() => setDeleteConfirm(null)} style={linkBtnStyle}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setDeleteConfirm(m.id)} style={{ ...linkBtnStyle, color: '#C4504A' }}>Del</button>
              )}
            </div>
          </div>
        </div>
        {children.map(child => renderMission(child, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', margin: 0 }}>Plan</h1>
        <button
          onClick={() => router.push('/plan/new')}
          style={{
            padding: '6px 16px', background: '#C4725A', color: '#FFF', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >+ New mission</button>
      </div>

      {missions.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8A8578', fontSize: 13 }}>
          No missions yet. Create one to start planning.
        </div>
      ) : (
        <div>
          {topLevel.map(m => renderMission(m, 0))}
          {orphans.map(m => renderMission(m, 0))}
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

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #E8E4DC', borderRadius: 4,
  padding: '3px 8px', fontSize: 10, color: '#8A8578', cursor: 'pointer', fontWeight: 600,
}
