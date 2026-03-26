import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ArrangePage from '@/components/plan/ArrangePage'

export default async function ArrangePageRoute({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return <ArrangePage missionId={missionId} />
}
