import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id passed through OAuth state
  const oauthError = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/map?calendar_error=access_denied`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/map?calendar_error=not_configured`)
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${baseUrl}/api/calendar/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/map?calendar_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbErr } = await supabase
    .from('calendar_connections')
    .upsert({
      user_id: state,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendar_ids: [],
      is_active: true,
    }, { onConflict: 'user_id,provider' })

  if (dbErr) {
    return NextResponse.redirect(`${baseUrl}/map?calendar_error=db_error`)
  }

  return NextResponse.redirect(`${baseUrl}/map?calendar_connected=true`)
}
