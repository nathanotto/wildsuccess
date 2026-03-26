'use client'
import AppNavBar from '@/components/shared/AppNavBar'

interface Props {
  displayName: string
  appRole?: string
  children: React.ReactNode
}

export default function AppLayoutShell({ displayName, appRole, children }: Props) {
  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", minHeight: '100vh', background: '#FAFAF7', color: '#2D2A26' }}>
      <AppNavBar displayName={displayName} appRole={appRole} />
      {appRole === 'mission_collaborator' && (
        <div style={{ padding: '4px 20px', background: '#F8F7F4', borderBottom: '1px solid #F0EDE6', fontSize: 11, color: '#8A8578', textAlign: 'center' }}>
          You have mission access. <a href="/api/access-requests" onClick={async (e) => { e.preventDefault(); await fetch('/api/access-requests', { method: 'POST' }); alert('Request sent!') }} style={{ color: '#C4725A', fontWeight: 600, cursor: 'pointer' }}>Request full access</a> to unlock your personal Map, daily view, and more.
        </div>
      )}
      {children}
    </div>
  )
}
