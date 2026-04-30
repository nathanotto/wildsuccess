'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { COLORS } from '@/lib/theme'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          preferred_name: preferredName || fullName.split(' ')[0],
        },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/map')
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 6 }

  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAF7', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <div style={{ width: 360, background: '#FFF', borderRadius: 16, border: '1px solid #F0EDE6', padding: '40px 36px' }}>
        <div style={{ marginBottom: 6 }}><img src="/brand/wordmark.svg" alt="Wild Success" style={{ height: 48, display: 'block' }} /></div>
        <div style={{ fontSize: 13, color: '#8A8578', marginBottom: 28 }}>Create your account</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Preferred Name <span style={{ fontWeight: 400, color: '#8A8578' }}>(optional)</span></label>
            <input
              type="text" value={preferredName} onChange={e => setPreferredName(e.target.value)}
              placeholder={fullName.split(' ')[0] || ''}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              style={inputStyle}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: '#C4504A', marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px', background: COLORS.primary, color: '#FFF',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div style={{ marginTop: 20, fontSize: 12, color: '#8A8578', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
