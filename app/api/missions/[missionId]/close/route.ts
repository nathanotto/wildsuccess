import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ missionId: string }> }

// GET — fetch closure summary data (stats for the closure page)
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params

  // Fetch mission, factors, COAs, commitments, log in parallel
  const [missionRes, factorsRes, coasRes, commitmentsRes, logRes, collabRes] = await Promise.all([
    supabase.from('missions').select('*').eq('id', missionId).single(),
    supabase.from('factors').select('id, status, factor_type').eq('mission_id', missionId),
    supabase.from('coas').select('id, action, status').eq('mission_id', missionId),
    supabase.from('commitments').select('id, status, user_id, description').eq('mission_id', missionId),
    supabase.from('mission_log').select('id, entry_type, description, created_at').eq('mission_id', missionId).order('created_at', { ascending: true }),
    supabase.from('mission_invitations').select('user_id, role, status, invitee_name').eq('mission_id', missionId),
  ])

  const mission = missionRes.data
  if (!mission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const factors = factorsRes.data ?? []
  const coas = coasRes.data ?? []
  const commitments = commitmentsRes.data ?? []
  const log = logRes.data ?? []
  const collaborators = collabRes.data ?? []

  // Compute summary stats
  const summary = {
    mission: {
      name: mission.name,
      description: mission.description,
      status: mission.status,
      closure_type: mission.closure_type,
      closure_note: mission.closure_note,
      closed_at: mission.closed_at,
      big_outcome_id: mission.big_outcome_id,
      created_at: mission.created_at,
    },
    collaborators: collaborators.map(c => ({ name: c.invitee_name, role: c.role, status: c.status })),
    factors: {
      total: factors.length,
      byType: {
        driver: factors.filter(f => f.factor_type === 'driver').length,
        constraint: factors.filter(f => f.factor_type === 'constraint').length,
        fact: factors.filter(f => f.factor_type === 'fact').length,
        assumption: factors.filter(f => f.factor_type === 'assumption').length,
      },
      active: factors.filter(f => f.status === 'active').length,
      resolved: factors.filter(f => f.status === 'resolved').length,
      invalidated: factors.filter(f => f.status === 'invalidated').length,
    },
    coas: {
      total: coas.length,
      byStatus: {
        proposed: coas.filter(c => c.status === 'proposed').length,
        committed: coas.filter(c => c.status === 'committed').length,
        completed: coas.filter(c => c.status === 'completed').length,
        abandoned: coas.filter(c => c.status === 'abandoned').length,
      },
    },
    commitments: {
      total: commitments.length,
      active: commitments.filter(c => c.status === 'active').length,
      completed: commitments.filter(c => c.status === 'completed').length,
      abandoned: commitments.filter(c => c.status === 'abandoned').length,
    },
    log: {
      total: log.length,
      milestones: log.filter(l => l.entry_type === 'mission_status_changed' || l.entry_type === 'coa_completed' || l.entry_type === 'coa_committed').map(l => ({
        description: l.description,
        date: l.created_at,
      })),
    },
    duration: {
      started: mission.created_at,
      days: Math.floor((Date.now() - new Date(mission.created_at).getTime()) / 86400000),
    },
  }

  return NextResponse.json(summary)
}

// POST — close the mission
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { missionId } = await params
  const body = await req.json()
  const { closure_type, closure_note } = body

  if (!closure_type) return NextResponse.json({ error: 'closure_type is required' }, { status: 400 })

  // Map closure_type to status
  const statusMap: Record<string, string> = {
    accomplished: 'completed',
    partially_accomplished: 'completed',
    shelved: 'shelved',
    superseded: 'superseded',
    abandoned: 'abandoned',
  }
  const newStatus = statusMap[closure_type] ?? 'completed'

  const { data: mission, error } = await supabase
    .from('missions')
    .update({
      status: newStatus,
      closure_type,
      closure_note: closure_note || null,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq('id', missionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log the closure
  await supabase.from('mission_log').insert({
    mission_id: missionId,
    user_id: user.id,
    entry_type: 'mission_status_changed',
    description: `Mission closed: ${closure_type}${closure_note ? '. ' + closure_note.slice(0, 200) : ''}`,
  })

  return NextResponse.json(mission)
}
