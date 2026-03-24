import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('intake_status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.intake_status === 'not_started') redirect('/setup')

  return <>{children}</>
}
