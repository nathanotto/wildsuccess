import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

async function refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const startDate = body.start_date
    ? new Date(body.start_date)
    : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const endDate = body.end_date
    ? new Date(body.end_date)
    : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .eq('is_active', true)
    .single()

  if (!conn) return NextResponse.json({ error: 'No calendar connected' }, { status: 404 })

  let accessToken = conn.access_token
  if (new Date(conn.token_expires_at) <= now) {
    const refreshed = await refreshToken(conn.refresh_token)
    if (!refreshed) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
    accessToken = refreshed.access_token
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await supabase
      .from('calendar_connections')
      .update({ access_token: accessToken, token_expires_at: expiresAt })
      .eq('id', conn.id)
  }

  const calendarIds: string[] = conn.calendar_ids?.length > 0 ? conn.calendar_ids : ['primary']
  let totalSynced = 0

  for (const calendarId of calendarIds) {
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })

    const evRes = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!evRes.ok) continue

    const evData = await evRes.json()
    const events: Record<string, unknown>[] = evData.items ?? []

    for (const ev of events) {
      if (ev.status === 'cancelled') continue
      const start = ev.start as Record<string, string> | undefined
      const end = ev.end as Record<string, string> | undefined
      const isAllDay = !!start?.date
      const startTime = isAllDay ? `${start?.date}T00:00:00Z` : start?.dateTime
      const endTime = isAllDay ? `${end?.date}T00:00:00Z` : end?.dateTime
      if (!startTime || !endTime) continue

      const row = {
        user_id: user.id,
        external_event_id: ev.id as string,
        external_series_id: (ev.recurringEventId as string) ?? null,
        calendar_id: calendarId,
        title: (ev.summary as string) ?? '(No title)',
        description: (ev.description as string) ?? null,
        start_time: startTime,
        end_time: endTime,
        location: (ev.location as string) ?? null,
        attendees: (ev.attendees as unknown[]) ?? null,
        is_all_day: isAllDay,
        recurrence_rule: ((ev.recurrence as string[]) ?? [])[0] ?? null,
        raw_event: ev,
        last_synced_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('calendar_events')
        .upsert(row, { onConflict: 'user_id,external_event_id' })

      if (!error) totalSynced++
    }
  }

  await supabase
    .from('calendar_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', conn.id)

  return NextResponse.json({ synced: totalSynced })
}
