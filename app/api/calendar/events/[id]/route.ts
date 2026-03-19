import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/calendar/events/[id]
// Hides a Google Calendar event: deletes the row and saves a 'hidden' classification
// so the sync route won't re-add it.
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Look up the event so we have external_event_id for the classification
  const { data: ev } = await supabase
    .from('calendar_events')
    .select('external_event_id, external_series_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!ev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Save hidden classification FIRST so sync won't re-add it
  await supabase
    .from('calendar_event_classifications')
    .upsert({
      user_id: user.id,
      match_key: ev.external_event_id,
      match_type: 'event',
      classification: 'hidden',
      display_label: null,
      suppressed_fingerprint: null,
    }, { onConflict: 'user_id,match_key' })

  // Delete the row from calendar_events
  await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
