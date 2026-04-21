import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MissionClosurePage from '@/components/plan/MissionClosurePage'

export default async function CloseMissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <MissionClosurePage />
}
