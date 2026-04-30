'use client'
import { useState, useEffect } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { useRouter } from 'next/navigation'
import type { MissionInvitation } from '@/lib/types'
import { COLORS } from '@/lib/theme'

interface Props { missionId: string }

export default function InvitePage({ missionId }: Props) {
  const router = useRouter()
  const [missionName, setMissionName] = useState('')
  const [email, setEmail] = useState('')
  const [invitations, setInvitations] = useState<MissionInvitation[]>([])
  const [participants, setParticipants] = useState<{ user_id: string; role: string; name: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; preferred_name: string; full_name: string }[]>([])
  const { toast, visible, show } = useActionToast()

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
      show('invite', `Invitation sent to ${email.trim()}`)
      setEmail('')
    } else {
      const e = await res.json()
      show('invite', e.error ?? 'Failed to send invitation', 'error')
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
      <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8, display: 'flex', gap: 8 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}`)}>Mission overview</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/coas`)}>Plan COAs</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/summary`)}>See the finished plan</span>
        <span>|</span>
        <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/plan/${missionId}/arrange`)}>Engage mission</span>
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 20px' }}>
        Invite collaborators to: <span style={{ color: COLORS.primary }}>{missionName}</span>
      </h1>

      {/* Invite by email */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 4 }}>Invite by email</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleInviteByEmail() }}
            placeholder="colleague@example.com" style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={handleInviteByEmail} style={{ padding: '8px 16px', background: COLORS.primary, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Invite</button>
            <ActionToast message={toast?.msg} visible={visible} type={toast?.type} position="below" />
          </div>
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

    </div>
  )
}
