import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import FactorsGuidedPage from '@/components/plan/FactorsGuidedPage'

export default async function FactorsPage({ params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { missionId } = await params
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#8A8578', fontSize: 13 }}>Loading…</div>}>
      <FactorsGuidedPage missionId={missionId} />
    </Suspense>
  )
}
