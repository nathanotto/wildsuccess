'use client'
import AppNavBar from '@/components/shared/AppNavBar'

interface Props {
  displayName: string
  children: React.ReactNode
}

export default function AppLayoutShell({ displayName, children }: Props) {
  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", minHeight: '100vh', background: '#FAFAF7', color: '#2D2A26' }}>
      <AppNavBar displayName={displayName} />
      {children}
    </div>
  )
}
