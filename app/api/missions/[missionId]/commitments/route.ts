import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params

  const { data, error } = await supabase
    .from('commitments')
    .select('*, coas(action, outcome, status, time_horizon), user_profiles!commitments_user_id_fkey(preferred_name, full_name)')
    .eq('mission_id', missionId)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get action item counts per COA
  const coaIds = [...new Set((data ?? []).map(c => c.coa_id))]
  const { data: actionItems } = await supabase
    .from('action_items')
    .select('id, coa_id, status, assigned_to')
    .in('coa_id', coaIds.length ? coaIds : ['__none__'])

  const aiByCoA: Record<string, { total: number; completed: number; unassigned: number }> = {}
  ;(actionItems ?? []).forEach(ai => {
    if (!aiByCoA[ai.coa_id]) aiByCoA[ai.coa_id] = { total: 0, completed: 0, unassigned: 0 }
    aiByCoA[ai.coa_id].total++
    if (ai.status === 'completed') aiByCoA[ai.coa_id].completed++
    if (!ai.assigned_to) aiByCoA[ai.coa_id].unassigned++
  })

  const result = (data ?? []).map(c => ({
    ...c,
    user_name: (c.user_profiles as { preferred_name: string | null; full_name: string | null } | null)?.preferred_name
      || (c.user_profiles as { preferred_name: string | null; full_name: string | null } | null)?.full_name || 'Unknown',
    coa_action: (c.coas as { action: string } | null)?.action ?? '',
    coa_outcome: (c.coas as { outcome: string | null } | null)?.outcome ?? null,
    coa_status: (c.coas as { status: string } | null)?.status ?? '',
    coa_time_horizon: (c.coas as { time_horizon: string } | null)?.time_horizon ?? 'unset',
    action_items: aiByCoA[c.coa_id] ?? { total: 0, completed: 0, unassigned: 0 },
    user_profiles: undefined,
    coas: undefined,
  }))

  return NextResponse.json(result)
}
