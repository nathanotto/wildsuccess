import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewDaysPage from '@/components/review/ReviewDaysPage'

export default async function ReviewDays() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, preferred_name, full_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name ?? profile?.preferred_name ?? profile?.full_name ?? user.email ?? ''

  return <ReviewDaysPage displayName={displayName} />
}
