import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MissionOverviewPage from '@/components/plan/MissionOverviewPage'

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return <MissionOverviewPage missionId={missionId} />
}
