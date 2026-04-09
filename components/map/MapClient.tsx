'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UserValue, LifeDomain, BigOutcome, Activity, UserProfile, IntakeQuestion, Marker } from '@/lib/types'
import WildSuccessMapSVG from './WildSuccessMapSVG'
import LifeMapSVG from './LifeMapSVG'
import EditValueModal from './EditValueModal'
import EditActivityModal from './EditActivityModal'
import EditBigOutcomeModal from './EditBigOutcomeModal'
import EditDomainModal from './EditDomainModal'
import Toast from './Toast'
import SeedQuestionsModal from './SeedQuestionsModal'
import QuickCapture from './QuickCapture'
import ContextualNudge from './ContextualNudge'
import WaterfallDiagram from './WaterfallDiagram'
import ActivitiesEditor from './ActivitiesEditor'

interface Props {
  userId: string
  userEmail: string
}

export type ModalState =
  | { type: 'editValue'; value: UserValue }
  | { type: 'newValue' }
  | { type: 'editActivity'; activity: Activity }
  | { type: 'newActivity' }
  | { type: 'editOutcome'; outcome: BigOutcome }
  | { type: 'newOutcome' }
  | { type: 'editDomain'; domain: LifeDomain }
  | { type: 'newDomain' }
  | null

export default function MapClient({ userId, userEmail }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<UserValue[]>([])
  const [domains, setDomains] = useState<LifeDomain[]>([])
  const [outcomes, setOutcomes] = useState<BigOutcome[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [overdueActivityIds, setOverdueActivityIds] = useState<string[]>([])
  const [domainHeat, setDomainHeat] = useState<Record<string, { heat: number; overdue_count: number }>>({})
  const [loading, setLoading] = useState(true)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [boMenu, setBoMenu] = useState<{ outcome: BigOutcome; pos: { x: number; y: number } } | null>(null)
  const [boMenuMode, setBoMenuMode] = useState<'menu' | 'nudge' | 'close' | 'close-note' | 'successor'>('menu')
  const [closureType, setClosureType] = useState<string | null>(null)
  const [closureNote, setClosureNote] = useState('')
  const [successorName, setSuccessorName] = useState('')
  const [nudgeInput, setNudgeInput] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [mapMode, setMapMode] = useState<'values' | 'life'>('values')
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [activitiesEditorOpen, setActivitiesEditorOpen] = useState(false)
  const [hopperCount, setHopperCount] = useState(0)
  const [missionsByOutcome, setMissionsByOutcome] = useState<Record<string, string>>({}) // bigOutcomeId -> missionId
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [unclosedDays, setUnclosedDays] = useState<string[]>([])
  const searchParams = useSearchParams()

  // Intake state
  const [seedQuestions, setSeedQuestions] = useState<IntakeQuestion[]>([])
  const [allQuestions, setAllQuestions] = useState<IntakeQuestion[]>([])
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const fetchAll = useCallback(async () => {
    const NC = { cache: 'no-store' } as const
    const [vRes, dRes, oRes, aRes, pRes, hRes, hopperRes, missionsRes] = await Promise.all([
      fetch('/api/values', NC),
      fetch('/api/life-domains', NC),
      fetch('/api/big-outcomes', NC),
      fetch('/api/activities', NC),
      fetch('/api/profile', NC),
      fetch('/api/map/heat', NC),
      fetch('/api/action-items?status=candidate', NC),
      fetch('/api/missions', NC),
    ])
    const [v, d, o, a, p, h, hopper, missions] = await Promise.all([
      vRes.json(), dRes.json(), oRes.json(), aRes.json(), pRes.json(), hRes.json(), hopperRes.json(), missionsRes.json(),
    ])
    if (Array.isArray(v)) {
      // Apply heat scores (0.0–1.0 from activity completions) to value scores (1–10 scale)
      const heatMap = new Map<string, number>()
      if (h?.heat) for (const { value_id, heat: heatVal } of h.heat) heatMap.set(value_id, heatVal)
      setValues(v.map((val: UserValue) => {
        const heat = heatMap.get(val.id)
        return heat !== undefined ? { ...val, score: Math.round(1 + heat * 9) } : val
      }))
    }
    if (Array.isArray(d)) setDomains(d)
    if (Array.isArray(o)) setOutcomes(o)
    if (Array.isArray(a)) setActivities(a)
    if (p && !p.error) setProfile(p)
    if (h && h.overdueActivityIds) setOverdueActivityIds(h.overdueActivityIds)
    if (h && h.domainHeat) {
      const dhMap: Record<string, { heat: number; overdue_count: number }> = {}
      for (const dh of h.domainHeat) dhMap[dh.domain_id] = { heat: dh.heat, overdue_count: dh.overdue_count }
      setDomainHeat(dhMap)
    }
    if (Array.isArray(hopper)) setHopperCount(hopper.length)
    if (Array.isArray(missions)) {
      const map: Record<string, string> = {}
      for (const m of missions) { if (m.big_outcome_id) map[m.big_outcome_id] = m.id }
      setMissionsByOutcome(map)
    }
    // Fetch unclosed days and recent markers
    fetch('/api/day-completion?unclosed=true', NC)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setUnclosedDays(d) })
    fetch('/api/markers', NC)
      .then(r => r.ok ? r.json() : [])
      .then(m => { if (Array.isArray(m)) setMarkers(m.slice(0, 8)) })
    setLoading(false)
  }, [])

  const fetchIntake = useCallback(async () => {
    const [qRes, rRes] = await Promise.all([
      fetch('/api/intake/questions'),
      fetch('/api/intake/responses'),
    ])
    const [questions, responses] = await Promise.all([qRes.json(), rRes.json()])

    if (Array.isArray(questions)) {
      setSeedQuestions(questions.filter((q: IntakeQuestion) => q.is_seed_question))
      setAllQuestions(questions)
    }
    if (Array.isArray(responses)) {
      setAnsweredIds(new Set(responses.map((r: { question_id: string }) => r.question_id)))
    }
  }, [])

  useEffect(() => {
    fetchAll()
    fetchIntake()
  }, [fetchAll, fetchIntake])

  // Check calendar connection status and handle OAuth callback
  useEffect(() => {
    fetch('/api/calendar/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.connected) setCalendarConnected(true) })

    const calConnected = searchParams.get('calendar_connected')
    const calError = searchParams.get('calendar_error')
    if (calConnected) {
      setCalendarConnected(true)
      showToast('Google Calendar connected!')
      // Trigger initial sync
      fetch('/api/calendar/sync', { method: 'POST' })
      window.history.replaceState({}, '', '/map')
    }
    if (calError) {
      showToast('Calendar connection failed: ' + calError, 'error')
      window.history.replaceState({}, '', '/map')
    }
  }, [searchParams, showToast])

  // Show welcome modal for in_progress users who haven't seen it yet
  useEffect(() => {
    if (!profile || loading) return
    if (
      profile.intake_status === 'in_progress' &&
      !profile.intake_progress?.welcome_shown &&
      seedQuestions.length > 0
    ) {
      setShowWelcomeModal(true)
    }
  }, [profile, loading, seedQuestions])

  async function handleWelcomeClose() {
    setShowWelcomeModal(false)
    // Mark welcome as shown
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intake_progress: {
          ...(profile?.intake_progress ?? {}),
          welcome_shown: true,
        },
      }),
    })
  }

  async function handleAnswer(questionId: string, responseValue: unknown) {
    const res = await fetch('/api/intake/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, response: responseValue }),
    })
    if (res.ok) {
      const data = await res.json()
      setAnsweredIds(prev => new Set([...prev, questionId]))
      const count = data.activities?.length ?? 0
      if (count > 0) {
        showToast(`Generated ${count} activit${count === 1 ? 'y' : 'ies'}`)
        await fetchAll()
      }
    } else {
      showToast('Failed to save answer', 'error')
    }
  }

  const displayName = profile?.preferred_name || profile?.display_name || userEmail.split('@')[0] || 'You'
  const userInitial = displayName[0].toUpperCase()
  const anyModalOpen = modal !== null || showWelcomeModal

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Sans 3', sans-serif", color: '#8A8578', fontSize: 13 }}>
        Loading your map...
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#FAFAF7', minHeight: '100vh', color: '#2D2A26' }}>


      {/* Map mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 0' }}>
        <div style={{ display: 'inline-flex', background: '#F0EDE6', borderRadius: 20, padding: 3, gap: 2 }}>
          {(['values', 'life'] as const).map(mode => (
            <button key={mode} onClick={() => setMapMode(mode)} style={{
              padding: '5px 18px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', border: 'none',
              background: mapMode === mode ? '#FFFFFF' : 'transparent',
              color: mapMode === mode ? '#2D2A26' : '#8A8578',
              boxShadow: mapMode === mode ? '0 1px 4px rgba(45,42,38,0.10)' : 'none',
            }}>
              {mode === 'values' ? 'Values Map' : 'Life Map'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
        {mapMode === 'values' && (
          <div style={{ width: 200, flexShrink: 0, paddingTop: 8 }}>
            {unclosedDays.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8A857D', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
                  Unclosed Days
                </div>
                {unclosedDays.map(d => (
                  <a
                    key={d}
                    href={`/today/complete?date=${d}`}
                    style={{ display: 'block', fontSize: 11, color: '#C4725A', textDecoration: 'none', padding: '2px 0', cursor: 'pointer' }}
                  >
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} →
                  </a>
                ))}
              </div>
            )}
            {markers.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8A857D', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
                  Recent Markers
                </div>
                {markers.map(m => {
                  const typeColor: Record<string, string> = { accomplished: '#5A9E6F', declared_complete: '#4B6A82', closed_with_succession: '#4B6A82', abandoned: '#8A857D', life_event: '#C4725A' }
                  return (
                    <div key={m.id} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#2D2A26', lineHeight: 1.3 }}>{m.title}</div>
                      <div style={{ fontSize: 9, color: typeColor[m.marker_type] ?? '#8A857D' }}>
                        {new Date(m.occurred_on + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {m.in_moment_note && ` · ${m.in_moment_note}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {mapMode === 'values' ? (
          <WildSuccessMapSVG
            values={values}
            activities={activities}
            outcomes={outcomes}
            overdueActivityIds={overdueActivityIds}
            displayName={displayName}
            missionsByOutcome={missionsByOutcome}
            onEditValue={(v) => setModal({ type: 'editValue', value: v })}
            onEditActivity={(a) => setModal({ type: 'editActivity', activity: a })}
            onEditOutcome={(o) => setModal({ type: 'editOutcome', outcome: o })}
            onAddValue={() => setModal({ type: 'newValue' })}
            onAddActivity={() => setModal({ type: 'newActivity' })}
            onAddOutcome={() => setModal({ type: 'newOutcome' })}
            onShowReference={() => setReferenceOpen(true)}
            onShowActivities={() => setActivitiesEditorOpen(true)}
            onOutcomeMenu={(o, pos) => { setBoMenu({ outcome: o, pos }); setBoMenuMode('menu') }}
          />
        ) : (
          <LifeMapSVG
            values={values}
            domains={domains}
            activities={activities}
            outcomes={outcomes}
            overdueActivityIds={overdueActivityIds}
            domainHeat={domainHeat}
            displayName={displayName}
            onEditDomain={(d) => setModal({ type: 'editDomain', domain: d })}
            onEditActivity={(a) => setModal({ type: 'editActivity', activity: a })}
            onEditOutcome={(o) => setModal({ type: 'editOutcome', outcome: o })}
            onAddActivity={() => setModal({ type: 'newActivity' })}
            onAddDomain={() => setModal({ type: 'newDomain' })}
            onAddOutcome={() => setModal({ type: 'newOutcome' })}
          />
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'editValue' && (
        <EditValueModal
          value={modal.value}
          activities={activities}
          outcomes={outcomes}
          onSave={async (data) => {
            const res = await fetch(`/api/values/${modal.value.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Value saved') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={async () => {
            const res = await fetch(`/api/values/${modal.value.id}`, { method: 'DELETE' })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Value deleted') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'newValue' && (
        <EditValueModal
          value={null}
          activities={[]}
          outcomes={[]}
          onSave={async (data) => {
            const res = await fetch('/api/values', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Value created') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={null}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editActivity' && (
        <EditActivityModal
          activity={modal.activity}
          values={values}
          domains={domains}
          outcomes={outcomes}
          onSave={async (data) => {
            const res = await fetch(`/api/activities/${modal.activity.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Activity saved') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={async () => {
            const res = await fetch(`/api/activities/${modal.activity.id}`, { method: 'DELETE' })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Activity deleted') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'newActivity' && (
        <EditActivityModal
          activity={null}
          values={values}
          domains={domains}
          outcomes={outcomes}
          onSave={async (data) => {
            const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Activity created') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={null}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editOutcome' && (
        <EditBigOutcomeModal
          outcome={modal.outcome}
          values={values}
          domains={domains}
          activities={activities}
          hasMission={!!missionsByOutcome[modal.outcome.id]}
          missionId={missionsByOutcome[modal.outcome.id] ?? null}
          onPlanThis={async (outcomeId: string) => {
            const res = await fetch(`/api/big-outcomes/${outcomeId}/plan`, { method: 'POST' })
            if (res.ok) {
              const { mission_id } = await res.json()
              router.push(`/plan/${mission_id}`)
            } else {
              const e = await res.json()
              if (e.mission_id) router.push(`/plan/${e.mission_id}`)
              else showToast(e.error, 'error')
            }
          }}
          onSave={async (data) => {
            const res = await fetch(`/api/big-outcomes/${modal.outcome.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Outcome saved') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={async () => {
            const res = await fetch(`/api/big-outcomes/${modal.outcome.id}`, { method: 'DELETE' })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Outcome deleted') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'newOutcome' && (
        <EditBigOutcomeModal
          outcome={null}
          values={values}
          domains={domains}
          activities={[]}
          onSave={async (data) => {
            const res = await fetch('/api/big-outcomes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Outcome created') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={null}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editDomain' && (
        <EditDomainModal
          domain={modal.domain}
          activities={activities}
          values={values}
          onSave={async (data) => {
            const res = await fetch(`/api/life-domains/${modal.domain.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Domain saved') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={async () => {
            const res = await fetch(`/api/life-domains/${modal.domain.id}`, { method: 'DELETE' })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Domain deleted') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'newDomain' && (
        <EditDomainModal
          domain={null}
          activities={[]}
          values={[]}
          onSave={async (data) => {
            const res = await fetch('/api/life-domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); setModal(null); showToast('Domain created') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={null}
          onClose={() => setModal(null)}
        />
      )}

      {/* Welcome / seed questions modal */}
      {showWelcomeModal && seedQuestions.length > 0 && (
        <SeedQuestionsModal
          questions={seedQuestions}
          answeredIds={answeredIds}
          onAnswer={handleAnswer}
          onClose={handleWelcomeClose}
        />
      )}

      {/* Quick capture */}
      {!anyModalOpen && (
        <QuickCapture
          onCaptured={() => {}}
          showToast={showToast}
        />
      )}

      {/* Contextual nudge — only when no modals open and not in_progress welcome */}
      {!anyModalOpen && allQuestions.length > 0 && (
        <ContextualNudge
          questions={allQuestions.filter(q => !q.is_seed_question)}
          answeredIds={answeredIds}
          onAnswer={async (qId, val) => {
            await handleAnswer(qId, val)
          }}
        />
      )}


      {referenceOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(45,42,38,0.40)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setReferenceOpen(false) }}
        >
          <div style={{
            background: '#FAFAF7', borderRadius: 16, boxShadow: '0 8px 40px rgba(45,42,38,0.18)',
            width: '90vw', maxWidth: 860, maxHeight: '90vh', overflowY: 'auto', position: 'relative',
          }}>
            <button
              onClick={() => setReferenceOpen(false)}
              style={{
                position: 'sticky', top: 12, float: 'right', marginRight: 16,
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: '#E8E4DC', cursor: 'pointer', fontSize: 16, color: '#5A5650',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
              }}
            >×</button>
            <WaterfallDiagram />
          </div>
        </div>
      )}

      {activitiesEditorOpen && (
        <ActivitiesEditor
          activities={activities}
          values={values}
          domains={domains}
          outcomes={outcomes}
          onSave={async (id, data) => {
            const res = await fetch(`/api/activities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); showToast('Activity saved') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onDelete={async (id) => {
            const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
            if (res.ok) { await fetchAll(); showToast('Activity deleted') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onCreate={async (data) => {
            const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            if (res.ok) { await fetchAll(); showToast('Activity created') }
            else { const e = await res.json(); showToast(e.error, 'error') }
          }}
          onClose={() => setActivitiesEditorOpen(false)}
        />
      )}

      {/* ── BO Menu Overlay ──────────────────────────────────────────────── */}
      {boMenu && (
        <>
          <div onClick={() => { setBoMenu(null); setBoMenuMode('menu'); setClosureType(null); setClosureNote(''); setSuccessorName(''); setNudgeInput('') }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{
            position: 'absolute', left: boMenu.pos.x, top: boMenu.pos.y, zIndex: 201,
            background: '#FAFAF7', border: '1px solid #E8E4DC', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: 8, minWidth: 220,
            fontFamily: '"Source Sans 3", sans-serif',
          }}>
            {boMenuMode === 'menu' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26', padding: '4px 8px', borderBottom: '1px solid #F0EDE8', marginBottom: 4 }}>{boMenu.outcome.name}</div>
                {boMenu.outcome.closure_type ? (
                  <button onClick={async () => {
                    await fetch(`/api/big-outcomes/${boMenu.outcome.id}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'in_progress', closure_type: null, closed_on: null, completed_at: null }),
                    })
                    showToast('Reopened.')
                    setBoMenu(null); await fetchAll()
                  }} style={{ textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2D2A26', borderRadius: 4, fontFamily: 'inherit' }}>Reopen</button>
                ) : (
                  <>
                    <button onClick={() => setBoMenuMode('nudge')} style={{ textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2D2A26', borderRadius: 4, fontFamily: 'inherit' }}>Nudge this week</button>
                    <button onClick={() => setBoMenuMode('close')} style={{ textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2D2A26', borderRadius: 4, fontFamily: 'inherit' }}>Close…</button>
                  </>
                )}
              </div>
            )}

            {boMenuMode === 'nudge' && (
              <div>
                <div style={{ fontSize: 11, color: '#8A857D', marginBottom: 6 }}>Nudge for {boMenu.outcome.name}</div>
                <input
                  autoFocus
                  value={nudgeInput}
                  onChange={e => setNudgeInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { setBoMenu(null); setNudgeInput('') }
                    if (e.key === 'Enter' && nudgeInput.trim()) {
                      await fetch(`/api/big-outcomes/${boMenu.outcome.id}/nudge`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: nudgeInput.trim(), time_type: 'B' }),
                      })
                      showToast('Added to hopper.')
                      setBoMenu(null); setNudgeInput('')
                    }
                  }}
                  placeholder="Nudge: …"
                  style={{ width: '100%', fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 6, padding: '6px 8px', background: '#FFF', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {boMenuMode === 'close' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, color: '#8A857D', marginBottom: 4 }}>How does this end?</div>
                {([
                  { type: 'accomplished', label: 'Accomplished', desc: 'The outcome was achieved as intended.' },
                  { type: 'declared_complete', label: 'Declared complete', desc: "I'm calling it done, even if the original vision shifted." },
                  { type: 'closed_with_succession', label: 'Closed with a successor', desc: 'This form is complete; a new Big Outcome continues the arc.' },
                  { type: 'abandoned', label: 'Abandoned', desc: "I'm letting this go without completing it." },
                ] as const).map(opt => (
                  <button key={opt.type} onClick={() => { setClosureType(opt.type); setBoMenuMode(opt.type === 'closed_with_succession' ? 'successor' : 'close-note') }}
                    style={{ textAlign: 'left', padding: '6px 8px', background: 'none', border: '1px solid #E8E4DC', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2A26' }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: '#8A857D' }}>{opt.desc}</div>
                  </button>
                ))}
                <div style={{ height: 1, background: '#E8E4DC', margin: '4px 0' }} />
                <button onClick={async () => {
                  if (!window.confirm('Delete this outcome entirely? No marker will be recorded.')) return
                  await fetch(`/api/big-outcomes/${boMenu.outcome.id}`, { method: 'DELETE' })
                  showToast('Outcome deleted.')
                  setBoMenu(null); await fetchAll()
                }} style={{ textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#C4504A', fontFamily: 'inherit' }}>
                  Delete — remove entirely, no marker
                </button>
              </div>
            )}

            {boMenuMode === 'successor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#8A857D' }}>Successor Big Outcome</div>
                <input autoFocus value={successorName} onChange={e => setSuccessorName(e.target.value)}
                  placeholder="Name for the successor (required)"
                  style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 6, padding: '6px 8px', background: '#FFF', outline: 'none' }} />
                <input value={closureNote} onChange={e => setClosureNote(e.target.value)}
                  placeholder="One line to capture this moment (optional)"
                  style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 6, padding: '6px 8px', background: '#FFF', outline: 'none' }} />
                <button disabled={!successorName.trim()} onClick={async () => {
                  const res = await fetch(`/api/big-outcomes/${boMenu.outcome.id}/close`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ closure_type: closureType, in_moment_note: closureNote || null, successor: { name: successorName.trim() } }),
                  })
                  if (res.ok) { showToast('Closed with successor.'); setBoMenu(null); setClosureType(null); setClosureNote(''); setSuccessorName(''); await fetchAll() }
                  else { const e = await res.json(); showToast(e.error, 'error') }
                }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: successorName.trim() ? '#2D2A26' : '#E8E4DC', color: '#FFF', cursor: successorName.trim() ? 'pointer' : 'default', fontSize: 12, fontFamily: 'inherit' }}>
                  Close and create successor
                </button>
              </div>
            )}

            {boMenuMode === 'close-note' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#8A857D' }}>
                  {closureType === 'accomplished' ? 'Accomplished' : closureType === 'declared_complete' ? 'Declared complete' : 'Abandoned'}
                </div>
                <input autoFocus value={closureNote} onChange={e => setClosureNote(e.target.value)}
                  placeholder="One line to capture this moment (optional)"
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { setBoMenu(null); setClosureType(null); setClosureNote('') }
                    if (e.key === 'Enter') {
                      const res = await fetch(`/api/big-outcomes/${boMenu.outcome.id}/close`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ closure_type: closureType, in_moment_note: closureNote || null }),
                      })
                      if (res.ok) {
                        const label = closureType === 'accomplished' ? 'Marked accomplished.' : closureType === 'declared_complete' ? 'Marked complete.' : 'Marked abandoned.'
                        showToast(label)
                        setBoMenu(null); setClosureType(null); setClosureNote(''); await fetchAll()
                      } else { const err = await res.json(); showToast(err.error, 'error') }
                    }
                  }}
                  style={{ fontSize: 12, border: '1px solid #E0DDD6', borderRadius: 6, padding: '6px 8px', background: '#FFF', outline: 'none' }} />
                <div style={{ fontSize: 10, color: '#B5B0A8' }}>Enter to confirm, Esc to cancel</div>
              </div>
            )}
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
