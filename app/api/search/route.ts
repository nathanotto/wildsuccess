import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const pattern = `%${q}%`

  // Search across action_items, item_notes, and action_log in parallel
  const [itemsRes, notesRes, logsRes] = await Promise.all([
    // Action items by name
    supabase
      .from('action_items')
      .select('id, name, status, committed_date, completed_date, created_at')
      .eq('user_id', user.id)
      .ilike('name', pattern)
      .order('created_at', { ascending: false })
      .limit(20),
    // Item notes (steps and notes) by content
    supabase
      .from('item_notes')
      .select('id, content, note_type, action_item_id, created_at')
      .eq('user_id', user.id)
      .ilike('content', pattern)
      .order('created_at', { ascending: false })
      .limit(20),
    // Action log (logged narrations) by note
    supabase
      .from('action_log')
      .select('id, note, metadata, event_type, event_date, created_at')
      .eq('user_id', user.id)
      .in('event_type', ['logged', 'captured'])
      .ilike('note', pattern)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Fetch parent item names for notes
  const noteParentIds = [...new Set((notesRes.data ?? []).filter(n => n.action_item_id).map(n => n.action_item_id))]
  const parentNames: Record<string, string> = {}
  if (noteParentIds.length > 0) {
    const { data: parents } = await supabase
      .from('action_items')
      .select('id, name')
      .in('id', noteParentIds as string[])
    for (const p of parents ?? []) parentNames[p.id] = p.name
  }

  const results: Array<{
    id: string
    type: 'action_item' | 'note' | 'log'
    text: string
    date: string | null
    parent_name?: string | null
    status?: string
    note_type?: string
  }> = []

  // Action items
  for (const item of itemsRes.data ?? []) {
    results.push({
      id: item.id,
      type: 'action_item',
      text: item.name,
      date: item.committed_date ?? item.created_at?.split('T')[0] ?? null,
      status: item.status,
    })
  }

  // Notes
  for (const note of notesRes.data ?? []) {
    results.push({
      id: note.id,
      type: 'note',
      text: note.content,
      date: note.created_at?.split('T')[0] ?? null,
      parent_name: note.action_item_id ? parentNames[note.action_item_id] ?? null : null,
      note_type: note.note_type,
    })
  }

  // Logs
  for (const log of logsRes.data ?? []) {
    const text = (log.metadata as Record<string, unknown> | null)?.cleanedName as string ?? log.note ?? ''
    if (!text) continue
    results.push({
      id: log.id,
      type: 'log',
      text,
      date: log.event_date,
    })
  }

  // Sort by date descending
  results.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return NextResponse.json(results.slice(0, 30))
}
