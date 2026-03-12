import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapClient from '@/components/map/MapClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MapClient userId={user.id} userEmail={user.email ?? ''} />
}
