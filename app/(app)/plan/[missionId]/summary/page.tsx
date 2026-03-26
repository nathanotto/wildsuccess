import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SummaryPage from '@/components/plan/SummaryPage'

export default async function PlanSummaryPage({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return <SummaryPage missionId={missionId} />
}
