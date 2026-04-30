'use client'
import { useState, useEffect } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { COLORS } from '@/lib/theme'

const COMMON_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu',
  'America/Phoenix', 'America/Boise',
  'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Rome', 'Europe/Madrid', 'Europe/Zurich',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Bogota',
  'Africa/Johannesburg', 'Africa/Cairo',
]

function tzLabel(tz: string): string {
  try {
    const now = new Date()
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? ''
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
    return `${city} (${offset})`
  } catch { return tz }
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState({ digest_enabled: true, digest_frequency: 'weekly', invitation_emails: true, commitment_reminders: true })
  const [timezone, setTimezone] = useState('America/Denver')
  const [loading, setLoading] = useState(true)
  const { toast, visible, show } = useActionToast()

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.communication_preferences) setPrefs(data.communication_preferences)
      if (data?.timezone) setTimezone(data.timezone)
      setLoading(false)
    })
  }, [])

  async function save() {
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communication_preferences: prefs, timezone }),
    })
    if (res.ok) show('save', 'Preferences saved')
  }

  if (loading) return <div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 500, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 16px' }}>Timezone</h1>
      <div style={{ marginBottom: 28 }}>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 13, color: '#2D2A26', width: '100%', maxWidth: 300 }}
        >
          {COMMON_TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tzLabel(tz)}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: '#8A8578', marginTop: 6 }}>
          Used for day boundaries and server-side date calculations. Change when traveling.
        </div>
      </div>

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

      <div style={{ position: 'relative', display: 'inline-block', marginTop: 20 }}>
        <button onClick={save} style={{ padding: '8px 20px', background: COLORS.primary, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save preferences
        </button>
        <ActionToast message={toast?.msg} visible={visible} position="right" />
      </div>
    </div>
  )
}
