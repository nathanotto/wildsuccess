import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CommitmentsPage from '@/components/plan/CommitmentsPage'

export default async function CommitmentsPageRoute({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { missionId } = await params
  return <CommitmentsPage missionId={missionId} />
}
