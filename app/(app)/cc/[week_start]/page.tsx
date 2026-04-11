import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompleteAndCreatePage from '@/components/cc/CompleteAndCreatePage'

export default async function CCWeekPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CompleteAndCreatePage />
}
