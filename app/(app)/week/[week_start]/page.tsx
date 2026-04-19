import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekRitualPage from '@/components/week/WeekRitualPage'

export default async function WeekPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <WeekRitualPage />
}
