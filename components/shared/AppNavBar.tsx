'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  displayName: string
  appRole?: string
  hopperCount?: number
  todayCount?: number
  overdueCount?: number
  calendarConnected?: boolean
}

const TABS = [
  { name: 'Map', path: '/map' },
  { name: 'Today', path: '/today', badgeKey: 'todayCount' as const, badgeColor: '#4B6A82' },
  { name: 'Organize', path: '/organize', badgeKey: 'hopperCount' as const, badgeColor: '#C4725A' },
  { name: 'Plan', path: '/plan' },
  { name: 'Communicate', path: null },
  { name: 'Review', path: '/review' },
  { name: 'Spending', path: null },
]

const COMING_SOON: Record<string, string> = {
  Communicate: 'Draft messages, emails, and communications connected to your activities and outcomes.',
  Spending: 'Review spending against your Financial Sufficiency threshold and budget commitments.',
}

export default function AppNavBar({ displayName, appRole, hopperCount = 0, todayCount = 0, overdueCount = 0, calendarConnected = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [comingSoon, setComingSoon] = useState<{ name: string; description: string } | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [connectingCal, setConnectingCal] = useState(false)

  const userInitial = (displayName || '?')[0].toUpperCase()

  const badges: Record<string, number> = { hopperCount, todayCount }

  function isActive(tabPath: string | null) {
    if (!tabPath) return false
    if (tabPath === '/review') return pathname.startsWith('/review')
    if (tabPath === '/plan') return pathname.startsWith('/plan')
    return pathname === tabPath
  }

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const MOBILE_QUICK_TABS = [
    { name: 'Today', path: '/today' },
    { name: 'Week', path: '/week' },
    { name: 'Review', path: '/review' },
  ]

  return (
    <>
      <style>{`
        .nav-full-tabs { display: flex; gap: 5px; align-items: center; }
        .nav-mobile-quick { display: none; }
        .nav-hamburger { display: none; }
        .nav-desktop-right { display: flex; align-items: center; }
        @media (max-width: 768px) {
          .nav-full-tabs { display: none !important; }
          .nav-mobile-quick { display: flex !important; gap: 4px; align-items: center; }
          .nav-hamburger { display: flex !important; }
          .nav-desktop-right { display: none !important; }
        }
      `}</style>
      <div style={{
        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 5,
        borderBottom: '1px solid #F0EDE6', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div
          onClick={() => router.push('/map')}
          style={{ fontSize: 14, fontWeight: 700, color: '#C4725A', marginRight: 10, cursor: 'pointer' }}
        >Wild Success</div>

        {/* Desktop: full tab bar */}
        <div className="nav-full-tabs">
          {TABS.filter(tab => {
            if (appRole === 'mission_collaborator') return tab.name === 'Plan'
            return true
          }).map(tab => {
            const active = isActive(tab.path)
            const badgeCount = tab.badgeKey ? badges[tab.badgeKey] ?? 0 : 0
            return (
              <button
                key={tab.name}
                onClick={() => {
                  if (tab.path) router.push(tab.path)
                  else setComingSoon({ name: tab.name, description: COMING_SOON[tab.name] ?? '' })
                }}
                style={{
                  padding: '3px 9px', borderRadius: 5,
                  border: active ? '1px solid #C4725A40' : '1px solid #F0EDE6',
                  fontSize: 10, fontWeight: 600,
                  color: active ? '#C4725A' : '#2D2A26',
                  cursor: 'pointer',
                  background: active ? '#C4725A08' : 'transparent',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#F8F7F4'; (e.currentTarget as HTMLElement).style.borderColor = '#C4725A40' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = '#F0EDE6' } }}
              >
                {tab.name}
                {badgeCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7,
                    background: tab.badgeColor ?? '#C4725A', color: 'white', fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>{badgeCount}</span>
                )}
              </button>
            )
          })}
          {overdueCount > 0 && (
            <span style={{ fontSize: 10, color: '#C4504A', fontWeight: 700, marginLeft: 4 }}>{overdueCount} overdue</span>
          )}
          {appRole === 'admin' && (
            <button onClick={() => router.push('/admin')}
              style={{ fontSize: 10, color: '#C4725A', cursor: 'pointer', marginLeft: 4, background: 'none', border: 'none', fontWeight: 600 }}>
              Admin
            </button>
          )}
        </div>

        {/* Mobile: quick tabs */}
        <div className="nav-mobile-quick">
          {MOBILE_QUICK_TABS.map(tab => {
            const active = isActive(tab.path)
            return (
              <button key={tab.name} onClick={() => router.push(tab.path)}
                style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                  border: active ? '1px solid #C4725A40' : '1px solid #F0EDE6',
                  color: active ? '#C4725A' : '#2D2A26',
                  background: active ? '#C4725A08' : 'transparent',
                  cursor: 'pointer',
                }}>
                {tab.name}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Desktop: settings, logout, user menu */}
        <div className="nav-desktop-right">
          <button onClick={() => router.push('/settings')}
            style={{ fontSize: 10, color: '#8A8578', cursor: 'pointer', marginRight: 6, background: 'none', border: 'none' }}>
            Settings
          </button>
          <button onClick={handleLogout}
            style={{ fontSize: 10, color: '#8A8578', cursor: 'pointer', marginRight: 6, background: 'none', border: 'none' }}>
            Log out
          </button>
        </div>

        {/* Mobile: hamburger */}
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A8578', padding: '0 4px', alignItems: 'center', justifyContent: 'center' }}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* User avatar — both desktop and mobile */}
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

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: 41, left: 0, right: 0, bottom: 0,
          background: 'rgba(45,42,38,0.15)', zIndex: 9,
        }} onClick={() => setMobileMenuOpen(false)}>
          <div style={{
            background: '#FFF', borderBottom: '1px solid #E8E4DC', padding: '8px 20px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }} onClick={e => e.stopPropagation()}>
            {TABS.map(tab => (
              <button key={tab.name} onClick={() => { if (tab.path) { router.push(tab.path); setMobileMenuOpen(false) } }}
                style={{
                  padding: '8px 12px', fontSize: 13, color: isActive(tab.path) ? '#C4725A' : '#2D2A26',
                  fontWeight: isActive(tab.path) ? 600 : 400, background: 'none', border: 'none',
                  cursor: tab.path ? 'pointer' : 'default', textAlign: 'left',
                  opacity: tab.path ? 1 : 0.4,
                }}>
                {tab.name}{!tab.path && ' (coming soon)'}
              </button>
            ))}
            <div style={{ height: 1, background: '#F0EDE6', margin: '4px 0' }} />
            <button onClick={() => { router.push('/settings'); setMobileMenuOpen(false) }}
              style={{ padding: '8px 12px', fontSize: 13, color: '#8A8578', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              Settings
            </button>
            <button onClick={handleLogout}
              style={{ padding: '8px 12px', fontSize: 13, color: '#8A8578', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              Log out
            </button>
          </div>
        </div>
      )}

      {comingSoon && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }} onClick={() => setComingSoon(null)}>
          <div style={{
            background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 400, width: '90%',
            border: '1px solid #E8E4DC',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 10 }}>{comingSoon.name}</div>
            <div style={{ fontSize: 13, color: '#8A8578', lineHeight: 1.6, marginBottom: 20 }}>{comingSoon.description}</div>
            <div style={{ fontSize: 12, color: '#C4725A', fontWeight: 600 }}>Coming soon</div>
            <button onClick={() => setComingSoon(null)} style={{
              marginTop: 20, padding: '8px 20px', background: '#F8F7F4', border: '1px solid #E8E4DC',
              borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#2D2A26',
            }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
