'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ComingSoonModal from './ComingSoonModal'

interface Props {
  displayName: string
  userInitial: string
  overdueCount: number
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

export default function NavBar({ displayName, userInitial, overdueCount, onNewValue, onNewActivity, onNewOutcome, onNewDomain }: Props) {
  const [comingSoon, setComingSoon] = useState<{ name: string; description: string } | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAISidebar, setShowAISidebar] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
            onClick={() => setComingSoon(m)}
            style={{
              padding: '3px 9px', borderRadius: 5, border: '1px solid #F0EDE6',
              fontSize: 10, fontWeight: 600, color: '#2D2A26', cursor: 'pointer', background: 'transparent',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4'; (e.currentTarget as HTMLElement).style.borderColor = '#C4725A40' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = '#F0EDE6' }}
          >{m.name}</button>
        ))}
        {overdueCount > 0 && (
          <span style={{ fontSize: 10, color: '#C4504A', fontWeight: 700, marginLeft: 4 }}>{overdueCount} overdue</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAISidebar(true)}
          style={{ fontSize: 10, color: '#8A8578', cursor: 'pointer', marginRight: 6, background: 'none', border: 'none' }}>
          AI Help
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
