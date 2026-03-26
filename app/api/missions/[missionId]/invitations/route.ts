import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { writeMissionLog } from '@/lib/mission-log'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const { data, error } = await supabase
    .from('mission_invitations')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const { email, role } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Get mission info
  const { data: mission } = await supabase.from('missions').select('name, description').eq('id', missionId).single()
  if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 })

  // Get inviter name
  const { data: profile } = await supabase.from('user_profiles').select('preferred_name, full_name').eq('id', user.id).single()
  const inviterName = profile?.preferred_name || profile?.full_name || user.email || 'Someone'

  // Check duplicate
  const { data: existing } = await supabase
    .from('mission_invitations')
    .select('id')
    .eq('mission_id', missionId)
    .eq('email', email.trim().toLowerCase())
    .limit(1)
  if (existing?.length) return NextResponse.json({ error: 'Already invited' }, { status: 409 })

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('mission_invitations')
    .insert({
      mission_id: missionId,
      invited_by: user.id,
      email: email.trim().toLowerCase(),
      role: role ?? 'collaborator',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if email belongs to existing user
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())

  if (existingUser) {
    // Auto-create participant row
    await supabase.from('mission_participants').upsert({
      mission_id: missionId,
      user_id: existingUser.id,
      role: role ?? 'collaborator',
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'mission_id,user_id' })
  }

  // Send email (check invitee preferences if they exist)
  let shouldSendEmail = true
  if (existingUser) {
    const { data: inviteeProfile } = await supabase.from('user_profiles').select('communication_preferences').eq('id', existingUser.id).single()
    if (inviteeProfile?.communication_preferences?.invitation_emails === false) shouldSendEmail = false
  }

  if (shouldSendEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const acceptLink = `${appUrl}/invitations/accept?token=${invitation.token}`
    try {
      await sendEmail({
        to: email.trim().toLowerCase(),
        subject: `${inviterName} invited you to plan: ${mission.name}`,
        html: `
          <p>${inviterName} wants to collaborate with you on a mission in Wild Success.</p>
          <p><strong>Mission:</strong> ${mission.name}</p>
          ${mission.description ? `<p>${mission.description.slice(0, 200)}</p>` : ''}
          <p><a href="${acceptLink}" style="display:inline-block;padding:10px 20px;background:#C4725A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation</a></p>
          <p style="color:#8A8578;font-size:13px;">Wild Success is a planning and commitment tool for people who want to accomplish big things together.</p>
        `,
      })
    } catch (e) {
      console.error('Failed to send invitation email:', e)
    }
  }

  await writeMissionLog(supabase, {
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'note',
    description: `Invited ${email.trim()} as ${role ?? 'collaborator'}`,
  })

  return NextResponse.json(invitation, { status: 201 })
}
