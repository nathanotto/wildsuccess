import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SetupClient from '@/components/setup/SetupClient'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('intake_status')
    .eq('id', user.id)
    .single()

  // If already past setup, go to map
  if (profile?.intake_status === 'in_progress' || profile?.intake_status === 'complete') {
    redirect('/map')
  }

  return <SetupClient />
}
