import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsPage from '@/components/plan/SettingsPage'

export default async function SettingsPageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <SettingsPage />
}
