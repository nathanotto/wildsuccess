import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminPage from '@/components/admin/AdminPage'

export default async function AdminPageRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('user_profiles').select('app_role').eq('id', user.id).single()
  if (profile?.app_role !== 'admin') redirect('/plan')

  return <AdminPage emailOverride={process.env.EMAIL_OVERRIDE || ''} />
}
