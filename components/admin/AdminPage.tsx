'use client'
import { useState, useEffect } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { COLORS } from '@/lib/theme'

interface AccessRequest {
  id: string; user_name: string; user_email: string; note: string | null; requested_at: string; status: string
}
interface UserRow {
  id: string; preferred_name: string | null; full_name: string | null; app_role: string; created_at: string
}

export default function AdminPage({ emailOverride }: { emailOverride?: string }) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const { toast, visible, show } = useActionToast()

  useEffect(() => {
    Promise.all([
      fetch('/api/access-requests').then(r => r.ok ? r.json() : []),
      fetch('/api/profile').then(r => r.json()), // just to verify we're admin
    ]).then(([reqs]) => {
      setRequests(Array.isArray(reqs) ? reqs : [])
      // Load all users
      fetch('/api/users/search?q=').then(r => r.json()).then(data => {
        setUsers(Array.isArray(data) ? data : [])
        setLoading(false)
      })
    })
  }, [])

  async function handleResolve(id: string, status: 'approved' | 'denied') {
    const res = await fetch(`/api/access-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const req = requests.find(r => r.id === id)
      setRequests(prev => prev.filter(r => r.id !== id))
      show(`resolve-${id}`, status === 'approved' ? `Access approved for ${req?.user_name ?? 'user'}` : `Request denied for ${req?.user_name ?? 'user'}`)
    }
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', margin: '0 0 24px' }}>Admin</h1>

      {/* Pending access requests */}
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Pending Access Requests</h2>
      {requests.length === 0 ? (
        <div style={{ fontSize: 12, color: '#B5B0A8', marginBottom: 24 }}>No pending requests.</div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {requests.map(r => (
            <div key={r.id} style={{ padding: '8px 12px', border: '1px solid #E8E4DC', borderRadius: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.user_name} <span style={{ color: '#8A8578', fontWeight: 400, fontSize: 11 }}>{r.user_email}</span></div>
                {r.note && <div style={{ fontSize: 11, color: '#8A8578' }}>{r.note}</div>}
                <div style={{ fontSize: 10, color: '#B5B0A8' }}>{new Date(r.requested_at).toLocaleDateString()}</div>
              </div>
              <div style={{ position: 'relative', flexShrink: 0, display: 'flex', gap: 4 }}>
                <button onClick={() => handleResolve(r.id, 'approved')} style={{ padding: '4px 10px', background: '#5A9E6F', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                <button onClick={() => handleResolve(r.id, 'denied')} style={{ padding: '4px 10px', background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Deny</button>
                <ActionToast message={toast?.id === `resolve-${r.id}` ? toast.msg : null} visible={visible && toast?.id === `resolve-${r.id}`} position="left" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User list */}
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Users</h2>
      <div>
        {users.map(u => (
          <div key={u.id} style={{ padding: '6px 12px', border: '1px solid #E8E4DC', borderRadius: 6, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{u.preferred_name || u.full_name || '?'}</span>
            <span style={{ fontSize: 10, color: u.app_role === 'admin' ? COLORS.primary : u.app_role === 'full' ? '#5A9E6F' : '#8A8578', fontWeight: 600 }}>{u.app_role}</span>
          </div>
        ))}
      </div>

      {/* App settings */}
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '24px 0 8px' }}>App Settings</h2>
      <div style={{ fontSize: 12, color: '#8A8578' }}>
        EMAIL_OVERRIDE: <strong>{emailOverride || '(not set — emails go to real recipients)'}</strong>
      </div>

    </div>
  )
}
