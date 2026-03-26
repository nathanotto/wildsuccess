import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function GET() {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sunday
  const digestDay = parseInt(process.env.DIGEST_DAY ?? '0')

  // Get all users with active commitments
  const { data: commitments } = await sb
    .from('commitments')
    .select('user_id, description, deadline, status, coa_id, mission_id, coas(action, outcome), missions(name)')
    .eq('status', 'active')

  if (!commitments?.length) return NextResponse.json({ sent: 0 })

  // Group by user
  const byUser: Record<string, typeof commitments> = {}
  for (const c of commitments) {
    if (!byUser[c.user_id]) byUser[c.user_id] = []
    byUser[c.user_id].push(c)
  }

  let sent = 0
  for (const [userId, userCommitments] of Object.entries(byUser)) {
    const { data: profile } = await sb.from('user_profiles').select('preferred_name, communication_preferences').eq('id', userId).single()
    if (!profile?.communication_preferences?.digest_enabled) continue

    // Frequency check
    const freq = profile.communication_preferences.digest_frequency ?? 'weekly'
    if (freq === 'weekly' && dayOfWeek !== digestDay) continue

    // Get user email
    const { data: { users } } = await sb.auth.admin.listUsers()
    const authUser = users?.find(u => u.id === userId)
    if (!authUser?.email) continue

    // Build email body
    const byMission: Record<string, { name: string; items: string[] }> = {}
    for (const c of userCommitments) {
      const missionName = (c.missions as unknown as { name: string } | null)?.name ?? 'Unknown Mission'
      const coaAction = (c.coas as unknown as { action: string; outcome: string | null } | null)?.action ?? ''
      const coaOutcome = (c.coas as unknown as { action: string; outcome: string | null } | null)?.outcome
      if (!byMission[c.mission_id]) byMission[c.mission_id] = { name: missionName, items: [] }
      byMission[c.mission_id].items.push(
        `<li><strong>${coaAction}</strong>${coaOutcome ? ` IOT ${coaOutcome}` : ''}<br/>` +
        `Your commitment: ${c.description || 'Committed'}` +
        `${c.deadline ? `<br/>Deadline: ${new Date(c.deadline).toLocaleDateString()}` : ''}</li>`
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let html = `<p>Here's what you've committed to:</p>`
    for (const [missionId, m] of Object.entries(byMission)) {
      html += `<h3><a href="${appUrl}/plan/${missionId}">${m.name}</a></h3><ul>${m.items.join('')}</ul>`
    }
    html += `<p><a href="${appUrl}/plan">View all your plans</a></p>`

    try {
      await sendEmail({
        to: authUser.email,
        subject: 'Your Wild Success Commitments',
        html,
      })
      sent++
    } catch (e) { console.error('Digest email failed for', userId, e) }
  }

  return NextResponse.json({ sent })
}
