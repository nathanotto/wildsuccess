'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { MissionInvitation } from '@/lib/types'

interface Props { missionId: string }

export default function InvitePage({ missionId }: Props) {
  const router = useRouter()
  const [missionName, setMissionName] = useState('')
  const [email, setEmail] = useState('')
  const [invitations, setInvitations] = useState<MissionInvitation[]>([])
  const [participants, setParticipants] = useState<{ user_id: string; role: string; name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; preferred_name: string; full_name: string }[]>([])
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/missions').then(r => r.json()),
      fetch(`/api/missions/${missionId}/invitations`).then(r => r.json()),
    ]).then(([missions, invs]) => {
      const m = (Array.isArray(missions) ? missions : []).find((ms: { id: string }) => ms.id === missionId)
      setMissionName(m?.name ?? '')
      setInvitations(Array.isArray(invs) ? invs : [])
    })
  }, [missionId])

  async function handleInviteByEmail() {
    if (!email.trim()) return
    const res = await fetch(`/api/missions/${missionId}/invitations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (res.ok) {
      const inv = await res.json()
      setInvitations(prev => [inv, ...prev])
      showToast(`Invitation sent to ${email.trim()}`)
      setEmail('')
    } else {
      const e = await res.json()
      showToast(e.error ?? 'Failed')
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
    const data = await res.json()
    setSearchResults(Array.isArray(data) ? data : [])
  }

  async function handleCancelInvitation(id: string) {
    await fetch(`/api/missions/${missionId}/invitations/${id}`, { method: 'DELETE' })
    setInvitations(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600, margin: '0 auto' }}>
      <button onClick={() => router.push(`/plan/${missionId}`)} style={{ background: 'none', border: 'none', color: '#8A8578', fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>
        ← Done inviting, continue
      </button>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 20px' }}>
        Invite collaborators to: <span style={{ color: '#C4725A' }}>{missionName}</span>
      </h1>

      {/* Invite by email */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 4 }}>Invite by email</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleInviteByEmail() }}
            placeholder="colleague@example.com" style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleInviteByEmail} style={{ padding: '8px 16px', background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Invite</button>
        </div>
      </div>

      {/* Search existing users */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 4 }}>Search by name</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Search users…" style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleSearch} style={{ padding: '8px 16px', background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Search</button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ fontSize: 12 }}>
            {searchResults.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span>{u.preferred_name || u.full_name}</span>
                <span style={{ fontSize: 11, color: '#8A8578' }}>When you invite people already using Wild Success, they get instant access.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.filter(i => i.status === 'pending').length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Pending invitations</h3>
          {invitations.filter(i => i.status === 'pending').map(inv => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
              <span>{inv.email}</span>
              <span style={{ color: '#8A8578', fontSize: 10 }}>{new Date(inv.created_at).toLocaleDateString()}</span>
              <button onClick={() => handleCancelInvitation(inv.id)} style={{ background: 'none', border: 'none', color: '#C4504A', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
            </div>
          ))}
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
