import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { COLORS } from '@/lib/theme'

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin
  const { data: profile } = await supabase.from('user_profiles').select('app_role').eq('id', user.id).single()
  if (profile?.app_role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { requestId } = await params
  const { status } = await request.json()

  const sb = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: req } = await sb.from('access_requests').select('user_id').eq('id', requestId).single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sb.from('access_requests').update({
    status,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', requestId)

  if (status === 'approved') {
    // Upgrade user to full
    await sb.from('user_profiles').update({ app_role: 'full' }).eq('id', req.user_id)

    // Seed map data for newly upgraded user
    await sb.rpc('seed_default_map_data', { p_user_id: req.user_id })

    // Send email
    const { data: { users } } = await sb.auth.admin.listUsers()
    const reqUser = users?.find(u => u.id === req.user_id)
    if (reqUser?.email) {
      const { data: reqProfile } = await sb.from('user_profiles').select('communication_preferences').eq('id', req.user_id).single()
      if (reqProfile?.communication_preferences?.invitation_emails !== false) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        try {
          await sendEmail({
            to: reqUser.email,
            subject: 'Welcome to Wild Success',
            html: `<p>Your request for full access has been approved.</p>
              <p>You now have access to your personal Map, daily view, weekly planning, and everything else Wild Success offers.</p>
              <p><a href="${appUrl}/map" style="display:inline-block;padding:10px 20px;background:${COLORS.primary};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Go to your Map</a></p>`,
          })
        } catch (e) { console.error('Failed to send approval email:', e) }
      }
    }
  }

  return NextResponse.json({ success: true })
}
