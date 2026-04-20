import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SearchPage from '@/components/search/SearchPage'

export default async function Search() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <SearchPage />
}
