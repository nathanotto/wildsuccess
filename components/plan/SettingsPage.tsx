'use client'
import { useState, useEffect, useRef } from 'react'

export default function SettingsPage() {
  const [prefs, setPrefs] = useState({ digest_enabled: true, digest_frequency: 'weekly', invitation_emails: true, commitment_reminders: true })
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500)
  }

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.communication_preferences) setPrefs(data.communication_preferences)
      setLoading(false)
    })
  }, [])

  async function save() {
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communication_preferences: prefs }),
    })
    if (res.ok) showToast('Preferences saved')
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 500, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 20px' }}>Communication Preferences</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={prefs.digest_enabled} onChange={e => setPrefs(p => ({ ...p, digest_enabled: e.target.checked }))} />
          Commitment digest emails
        </label>
        {prefs.digest_enabled && (
          <div style={{ paddingLeft: 24 }}>
            <select value={prefs.digest_frequency} onChange={e => setPrefs(p => ({ ...p, digest_frequency: e.target.value }))}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #E8E4DC', fontSize: 12 }}>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={prefs.invitation_emails} onChange={e => setPrefs(p => ({ ...p, invitation_emails: e.target.checked }))} />
          Mission invitation emails
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={prefs.commitment_reminders} onChange={e => setPrefs(p => ({ ...p, commitment_reminders: e.target.checked }))} />
          Commitment reminder emails
        </label>
      </div>

      <button onClick={save} style={{ marginTop: 20, padding: '8px 20px', background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Save preferences
      </button>

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
