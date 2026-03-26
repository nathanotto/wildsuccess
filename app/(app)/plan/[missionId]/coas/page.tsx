import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import COAsPage from '@/components/plan/COAsPage'

export default async function CoasPage({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return <COAsPage missionId={missionId} />
}
