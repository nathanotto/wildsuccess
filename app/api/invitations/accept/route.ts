import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { writeMissionLog } from '@/lib/mission-log'

// GET: public lookup by token (no auth required)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Use service role to bypass RLS for public token lookup
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invitation, error } = await sb
    .from('mission_invitations')
    .select('id, mission_id, email, role, status, missions(name, description), invited_by')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    console.error('Invitation lookup failed:', { token, error: error?.message, hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY })
    return NextResponse.json({ error: 'Invitation not found', detail: error?.message || 'no data' }, { status: 404 })
  }
  if (invitation.status !== 'pending') return NextResponse.json({ error: 'Invitation already used', status: invitation.status }, { status: 410 })

  // Get inviter name
  const { data: inviterProfile } = await sb.from('user_profiles').select('preferred_name, full_name').eq('id', invitation.invited_by).single()

  const missionData = invitation.missions as unknown as { name: string; description: string | null } | null
  return NextResponse.json({
    invitation_id: invitation.id,
    mission_id: invitation.mission_id,
    mission_name: missionData?.name ?? '',
    mission_description: missionData?.description ?? null,
    email: invitation.email,
    role: invitation.role,
    inviter_name: inviterProfile?.preferred_name || inviterProfile?.full_name || 'Someone',
  })
}

// POST: accept invitation (auth required)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Use service role for the lookup
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invitation } = await sb
    .from('mission_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (!invitation) return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 })

  // Verify email matches
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({
      error: `This invitation was sent to ${invitation.email}. Log in with that account or ask for a new invitation.`,
    }, { status: 403 })
  }

  // Add to mission_participants
  await sb.from('mission_participants').upsert({
    mission_id: invitation.mission_id,
    user_id: user.id,
    role: invitation.role,
    accepted_at: new Date().toISOString(),
  }, { onConflict: 'mission_id,user_id' })

  // Mark invitation accepted
  await sb.from('mission_invitations').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  }).eq('id', invitation.id)

  // Log
  await writeMissionLog(supabase, {
    mission_id: invitation.mission_id,
    user_id: user.id,
    entry_type: 'note',
    description: `${user.email} joined the mission`,
  })

  return NextResponse.json({ mission_id: invitation.mission_id })
}
