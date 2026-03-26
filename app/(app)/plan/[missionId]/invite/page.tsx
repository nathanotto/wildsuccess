import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InvitePage from '@/components/plan/InvitePage'

export default async function InvitePageRoute({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { missionId } = await params
  return <InvitePage missionId={missionId} />
}
