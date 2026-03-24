'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ComingSoonModal from './ComingSoonModal'

interface Props {
  displayName: string
  userInitial: string
  overdueCount: number
  hopperCount: number
  todayCount?: number
  calendarConnected: boolean
  onOrganize: () => void
  onNewValue: () => void
  onNewActivity: () => void
  onNewOutcome: () => void
  onNewDomain: () => void
}

const ACTION_MODES = [
  { name: 'Today', description: 'Review your day — what needs attention right now, what is overdue, and what you committed to today.' },
  { name: 'Organize', description: 'Manage your activities, values, and life domains. Add, edit, reorder, or deactivate.' },
  { name: 'Plan', description: 'Turn aspirations into commitments. Schedule activities, set target dates, build out Big Outcomes.' },
  { name: 'Communicate', description: 'Draft messages, emails, and communications connected to your activities and outcomes.' },
  { name: 'Review', description: 'Reflect on the week. Review completed activities, assess value fulfillment, generate planning inputs.' },
  { name: 'Spending', description: 'Review spending against your Financial Sufficiency threshold and budget commitments.' },
]

export default function NavBar({ displayName, userInitial, overdueCount, hopperCount, todayCount = 0, calendarConnected, onOrganize, onNewValue, onNewActivity, onNewOutcome, onNewDomain }: Props) {
  const [comingSoon, setComingSoon] = useState<{ name: string; description: string } | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAISidebar, setShowAISidebar] = useState(false)
  const [connectingCal, setConnectingCal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleConnectCalendar() {
    setConnectingCal(true)
    try {
      const res = await fetch('/api/calendar/connect', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        alert('Calendar connection failed: ' + (data.error ?? 'unknown error'))
        setConnectingCal(false)
      }
    } catch {
      alert('Calendar connection failed — check console')
      setConnectingCal(false)
    }
  }

  async function handleDisconnectCalendar() {
    await fetch('/api/calendar/connect', { method: 'DELETE' })
    setShowUserMenu(false)
    window.location.reload()
  }

  return (
    <>
      <div style={{
        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 5,
        borderBottom: '1px solid #F0EDE6', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#C4725A', marginRight: 10 }}>Wild Success</div>
        {ACTION_MODES.map(m => (
          <button key={m.name}
            onClick={() => {
              if (m.name === 'Organize') onOrganize()
              else if (m.name === 'Today') router.push('/today')
              else if (m.name === 'Review') router.push('/review')
              else setComingSoon(m)
            }}
            style={{
              padding: '3px 9px', borderRadius: 5, border: '1px solid #F0EDE6',
              fontSize: 10, fontWeight: 600, color: '#2D2A26', cursor: 'pointer', background: 'transparent',
              position: 'relative',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4'; (e.currentTarget as HTMLElement).style.borderColor = '#C4725A40' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = '#F0EDE6' }}
          >
            {m.name}
            {m.name === 'Organize' && hopperCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7,
                background: '#C4725A', color: 'white', fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{hopperCount}</span>
            )}
            {m.name === 'Today' && todayCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7,
                background: '#4B6A82', color: 'white', fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{todayCount}</span>
            )}
          </button>
        ))}
        {overdueCount > 0 && (
          <span style={{ fontSize: 10, color: '#C4504A', fontWeight: 700, marginLeft: 4 }}>{overdueCount} overdue</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAISidebar(true)}
          style={{ fontSize: 10, color: '#8A8578', cursor: 'pointer', marginRight: 6, background: 'none', border: 'none' }}>
          AI Help
        </button>
        <button onClick={handleLogout}
          style={{ fontSize: 10, color: '#8A8578', cursor: 'pointer', marginRight: 6, background: 'none', border: 'none' }}>
          Log out
        </button>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: 24, height: 24, borderRadius: '50%', background: '#C4725A20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#C4725A', cursor: 'pointer',
            }}>{userInitial}</div>
          {showUserMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 30, background: '#FFF', border: '1px solid #E8E4DC',
              borderRadius: 8, padding: '4px 0', minWidth: 140, zIndex: 20, boxShadow: '0 4px 16px #2D2A2610',
            }}>
              <div style={{ padding: '6px 14px', fontSize: 11, color: '#8A8578' }}>{displayName}</div>
              <div style={{ height: 1, background: '#F0EDE6', margin: '2px 0' }} />
              {calendarConnected ? (
                <button onClick={handleDisconnectCalendar}
                  style={{ display: 'block', width: '100%', padding: '6px 14px', fontSize: 12, color: '#8A8578', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  ✓ Calendar connected
                </button>
              ) : (
                <button onClick={handleConnectCalendar} disabled={connectingCal}
                  style={{ display: 'block', width: '100%', padding: '6px 14px', fontSize: 12, color: '#4B82AF', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  {connectingCal ? 'Connecting…' : '+ Connect Google Calendar'}
                </button>
              )}
              <div style={{ height: 1, background: '#F0EDE6', margin: '2px 0' }} />
              <button onClick={handleLogout}
                style={{ display: 'block', width: '100%', padding: '6px 14px', fontSize: 12, color: '#2D2A26', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {comingSoon && <ComingSoonModal name={comingSoon.name} description={comingSoon.description} onClose={() => setComingSoon(null)} />}

      {showAISidebar && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 320, background: '#FFF',
          borderLeft: '1px solid #E8E4DC', zIndex: 50, padding: 24,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2A26' }}>AI Help</div>
            <button onClick={() => setShowAISidebar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A8578' }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: '#8A8578' }}>AI assistant coming soon.</div>
        </div>
      )}
    </>
  )
}
