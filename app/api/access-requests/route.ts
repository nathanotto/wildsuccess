import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin
  const { data: profile } = await supabase.from('user_profiles').select('app_role').eq('id', user.id).single()
  if (profile?.app_role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb.from('access_requests').select('*').eq('status', 'pending').order('requested_at')

  // Join user info
  const result = await Promise.all((data ?? []).map(async r => {
    const { data: up } = await sb.from('user_profiles').select('preferred_name, full_name').eq('id', r.user_id).single()
    const { data: { users } } = await sb.auth.admin.listUsers()
    const authUser = users?.find(u => u.id === r.user_id)
    return { ...r, user_name: up?.preferred_name || up?.full_name || 'Unknown', user_email: authUser?.email || '' }
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await request.json().catch(() => ({ note: null }))

  const { data, error } = await supabase
    .from('access_requests')
    .insert({ user_id: user.id, note: note || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admin
  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: admins } = await sb.from('user_profiles').select('id, communication_preferences').eq('app_role', 'admin')
  const { data: requesterProfile } = await sb.from('user_profiles').select('preferred_name, full_name').eq('id', user.id).single()
  const requesterName = requesterProfile?.preferred_name || requesterProfile?.full_name || 'A user'

  for (const admin of (admins ?? [])) {
    if (admin.communication_preferences?.commitment_reminders === false) continue
    const { data: { users } } = await sb.auth.admin.listUsers()
    const adminUser = users?.find(u => u.id === admin.id)
    if (!adminUser?.email) continue
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      await sendEmail({
        to: adminUser.email,
        subject: `Wild Success: Access request from ${requesterName}`,
        html: `<p><strong>${requesterName}</strong> (${user.email}) is requesting full access to Wild Success.</p>
          <p>Note: ${note || 'No note provided'}</p>
          <p><a href="${appUrl}/admin">Review in Admin Panel</a></p>`,
      })
    } catch (e) { console.error('Failed to send admin notification:', e) }
  }

  return NextResponse.json(data, { status: 201 })
}
