import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import SummaryPage from '@/components/plan/SummaryPage'

export default async function PlanSummaryPage({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>}>
      <SummaryPage missionId={missionId} />
    </Suspense>
  )
}
