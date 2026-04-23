'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CommitmentData {
  id: string; coa_id: string; user_id: string; description: string | null
  deadline: string | null; status: string; user_name: string
  coa_action: string; coa_outcome: string | null; coa_status: string; coa_time_horizon: string
  action_items: { total: number; completed: number; unassigned: number }
}

interface Props { missionId: string }

export default function CommitmentsPage({ missionId }: Props) {
  const router = useRouter()
  const [missionName, setMissionName] = useState('')
  const [commitments, setCommitments] = useState<CommitmentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/commitments`).then(r => r.json()),
    ]).then(([missions, cData]) => {
      const m = (Array.isArray(missions) ? missions : []).find((ms: { id: string }) => ms.id === missionId)
      setMissionName(m?.name ?? '')
      setCommitments(Array.isArray(cData) ? cData : [])
      setLoading(false)
    })
  }, [missionId])

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  // Group by COA
  const byCoa: Record<string, { action: string; outcome: string | null; status: string; horizon: string; commitments: CommitmentData[] }> = {}
  for (const c of commitments) {
    if (!byCoa[c.coa_id]) byCoa[c.coa_id] = { action: c.coa_action, outcome: c.coa_outcome, status: c.coa_status, horizon: c.coa_time_horizon, commitments: [] }
    byCoa[c.coa_id].commitments.push(c)
  }

  const active = commitments.filter(c => c.status === 'active').length
  const completed = commitments.filter(c => c.status === 'completed').length
  const totalAI = commitments.reduce((s, c) => s + c.action_items.total, 0)
  const completedAI = commitments.reduce((s, c) => s + c.action_items.completed, 0)
  const unassignedAI = commitments.reduce((s, c) => s + c.action_items.unassigned, 0)
  const people = [...new Set(commitments.map(c => c.user_name))]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8, display: 'flex', gap: 8 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Plan COAs</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary`)}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 12px' }}>
        Commitments for: <span style={{ color: '#C4725A' }}>{missionName}</span>
      </h1>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 11, color: '#8A8578', flexWrap: 'wrap' }}>
        <span>{active} active, {completed} completed commitments</span>
        <span>{totalAI - completedAI} open, {completedAI} completed, {unassignedAI} unassigned items</span>
        <span>People: {people.join(', ')}</span>
      </div>

      {Object.keys(byCoa).length === 0 ? (
        <div style={{ padding: 20, color: '#B5B0A8', fontSize: 12, textAlign: 'center' }}>No commitments yet.</div>
      ) : (
        Object.entries(byCoa).map(([coaId, coa]) => (
          <div key={coaId} style={{ marginBottom: 16, border: '1px solid #E8E4DC', borderRadius: 8, padding: '12px 16px', background: '#FFF' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2A26', marginBottom: 4 }}>
              {coa.action}{coa.outcome ? <span style={{ color: '#B5B0A8', fontSize: 11, fontWeight: 700, margin: '0 4px' }}>IOT</span> : ''}{coa.outcome ?? ''}
            </div>
            <div style={{ fontSize: 10, color: '#8A8578', marginBottom: 8 }}>{coa.status} · {coa.horizon}</div>
            {coa.commitments.map(c => (
              <div key={c.id} style={{ paddingLeft: 12, borderLeft: '2px solid #C4725A40', marginBottom: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#C4725A', fontWeight: 600 }}>{c.user_name}</span>
                  <span style={{ fontSize: 10, color: c.status === 'completed' ? '#5A9E6F' : c.status === 'abandoned' ? '#C4504A' : '#8A8578', fontWeight: 600 }}>{c.status}</span>
                  {c.deadline && <span style={{ fontSize: 10, color: '#8A8578' }}>Due: {new Date(c.deadline).toLocaleDateString()}</span>}
                </div>
                {c.description && <div style={{ fontSize: 11, color: '#8A8578', marginTop: 2 }}>{c.description}</div>}
                <div style={{ fontSize: 10, color: '#8A8578', marginTop: 2 }}>
                  Items: {c.action_items.total - c.action_items.completed} open, {c.action_items.completed} done
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
