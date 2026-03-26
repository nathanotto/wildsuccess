import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanListPage from '@/components/plan/PlanListPage'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PlanListPage />
}
