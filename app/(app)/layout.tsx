import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayoutShell from './AppLayoutShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('intake_status, display_name, preferred_name, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.intake_status === 'not_started') redirect('/setup')

  const displayName = profile.display_name ?? profile.preferred_name ?? profile.full_name ?? user.email ?? ''

  return (
    <AppLayoutShell displayName={displayName}>
      {children}
    </AppLayoutShell>
  )
}
