import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayoutShell from './AppLayoutShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('intake_status, display_name, preferred_name, full_name, app_role')
    .eq('id', user.id)
    .single()

  const appRole = (profile as Record<string, unknown>)?.app_role as string ?? 'mission_collaborator'

  // Mission collaborators skip the intake/setup check — they only need /plan
  // For full/admin users, only redirect to setup if intake is explicitly 'not_started'
  if (appRole !== 'mission_collaborator' && profile?.intake_status === 'not_started') redirect('/setup')

  const displayName = profile?.display_name ?? profile?.preferred_name ?? profile?.full_name ?? user.email ?? ''

  return (
    <AppLayoutShell displayName={displayName} appRole={appRole}>
      {children}
    </AppLayoutShell>
  )
}
