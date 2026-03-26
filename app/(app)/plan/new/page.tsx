import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanNewPage from '@/components/plan/PlanNewPage'

export default async function NewMissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PlanNewPage />
}
