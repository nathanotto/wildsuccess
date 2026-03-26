'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function AcceptContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const supabase = createClient()

  const [invitation, setInvitation] = useState<{
    mission_name: string; mission_description: string | null
    email: string; role: string; inviter_name: string; mission_id: string
  } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [mode, setMode] = useState<'view' | 'login' | 'signup'>('view')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!token) { setError('No invitation token'); setLoading(false); return }
    // Check auth
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) setUser({ id: u.id, email: u.email ?? '' })
    })
    // Fetch invitation
    fetch(`/api/invitations/accept?token=${token}`).then(r => r.json()).then(data => {
      if (data.error) setError(data.error)
      else { setInvitation(data); setEmail(data.email) }
      setLoading(false)
    })
  }, [token, supabase.auth])

  async function handleAccept() {
    setAuthLoading(true)
    const res = await fetch('/api/invitations/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/plan/${data.mission_id}`)
    else setAuthError(data.error)
    setAuthLoading(false)
  }

  async function handleLogin() {
    setAuthLoading(true); setAuthError('')
    const { error: e } = await supabase.auth.signInWithPassword({ email, password })
    if (e) { setAuthError(e.message); setAuthLoading(false); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) { setUser({ id: u.id, email: u.email ?? '' }); await handleAcceptAfterAuth() }
    setAuthLoading(false)
  }

  async function handleSignup() {
    setAuthLoading(true); setAuthError('')
    const { error: e } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, preferred_name: fullName.split(' ')[0] } },
    })
    if (e) { setAuthError(e.message); setAuthLoading(false); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) { setUser({ id: u.id, email: u.email ?? '' }); await handleAcceptAfterAuth() }
    setAuthLoading(false)
  }

  async function handleAcceptAfterAuth() {
    const res = await fetch('/api/invitations/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/plan/${data.mission_id}`)
    else setAuthError(data.error)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8A8578' }}>Loading…</div>
  if (error) return <div style={{ padding: 60, textAlign: 'center', color: '#C4504A' }}>{error}</div>
  if (!invitation) return null

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: '0 20px', fontFamily: 'inherit' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#C4725A', marginBottom: 20 }}>Wild Success</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D2A26', margin: '0 0 8px' }}>You&apos;re invited to plan</h1>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#2D2A26', margin: '0 0 8px' }}>{invitation.mission_name}</h2>
      {invitation.mission_description && <p style={{ fontSize: 13, color: '#8A8578', margin: '0 0 12px' }}>{invitation.mission_description.slice(0, 200)}</p>}
      <p style={{ fontSize: 12, color: '#8A8578', marginBottom: 24 }}>Invited by {invitation.inviter_name}</p>

      {authError && <div style={{ color: '#C4504A', fontSize: 12, marginBottom: 12 }}>{authError}</div>}

      {user ? (
        user.email.toLowerCase() === invitation.email.toLowerCase() ? (
          <button onClick={handleAccept} disabled={authLoading} style={btnStyle}>{authLoading ? 'Joining…' : 'Join this mission'}</button>
        ) : (
          <div style={{ fontSize: 13, color: '#C4504A' }}>
            This invitation was sent to {invitation.email}. You&apos;re logged in as {user.email}. Log in with the invited account or ask for a new invitation.
          </div>
        )
      ) : mode === 'view' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => setMode('login')} style={btnStyle}>I have an account</button>
          <button onClick={() => setMode('signup')} style={{ ...btnStyle, background: '#F8F7F4', color: '#2D2A26', border: '1px solid #E8E4DC' }}>I&apos;m new</button>
        </div>
      ) : mode === 'login' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter') handleLogin() }} />
          <button onClick={handleLogin} disabled={authLoading} style={btnStyle}>{authLoading ? 'Logging in…' : 'Log in and join'}</button>
          <button onClick={() => setMode('view')} style={{ background: 'none', border: 'none', color: '#8A8578', fontSize: 12, cursor: 'pointer' }}>← Back</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" style={inputStyle} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter') handleSignup() }} />
          <button onClick={handleSignup} disabled={authLoading} style={btnStyle}>{authLoading ? 'Creating account…' : 'Sign up and join'}</button>
          <button onClick={() => setMode('view')} style={{ background: 'none', border: 'none', color: '#8A8578', fontSize: 12, cursor: 'pointer' }}>← Back</button>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '10px 24px', background: '#C4725A', color: '#FFF', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13,
  outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}

export default function AcceptPage() {
  return <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: '#8A8578' }}>Loading…</div>}><AcceptContent /></Suspense>
}
