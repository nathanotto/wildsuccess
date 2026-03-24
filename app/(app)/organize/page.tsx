import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrganizePage from '@/components/organize/OrganizePage'

export default async function Organize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, valuesRes, domainsRes] = await Promise.all([
    supabase.from('user_profiles').select('intake_status').eq('id', user.id).single(),
    supabase.from('user_values').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('life_domains').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
  ])

  if (!profileRes.data || profileRes.data.intake_status === 'not_started') redirect('/setup')

  return (
    <OrganizePage
      values={valuesRes.data ?? []}
      domains={domainsRes.data ?? []}
    />
  )
}
