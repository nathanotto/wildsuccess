'use client'
import { useState, useEffect, useCallback } from 'react'
import { UserValue, LifeDomain, BigOutcome, Activity, UserProfile, IntakeQuestion } from '@/lib/types'
import WildSuccessMapSVG from './WildSuccessMapSVG'
import LifeMapSVG from './LifeMapSVG'
import NavBar from './NavBar'
import TakeActionBox from './TakeActionBox'
import EditValueModal from './EditValueModal'
import EditActivityModal from './EditActivityModal'
import EditBigOutcomeModal from './EditBigOutcomeModal'
import EditDomainModal from './EditDomainModal'
import Toast from './Toast'
import SeedQuestionsModal from './SeedQuestionsModal'
import QuickCapture from './QuickCapture'
import ContextualNudge from './ContextualNudge'
import OrganizeWeekModal from '@/components/organize/OrganizeWeekModal'

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
  const [values, setValues] = useState<UserValue[]>([])
  const [domains, setDomains] = useState<LifeDomain[]>([])
  const [outcomes, setOutcomes] = useState<BigOutcome[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [overdueActivityIds, setOverdueActivityIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [mapMode, setMapMode] = useState<'values' | 'life'>('values')
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [hopperCount, setHopperCount] = useState(0)

  // Intake state
  const [seedQuestions, setSeedQuestions] = useState<IntakeQuestion[]>([])
  const [allQuestions, setAllQuestions] = useState<IntakeQuestion[]>([])
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchAll = useCallback(async () => {
    const [vRes, dRes, oRes, aRes, pRes, hRes, hopperRes] = await Promise.all([
      fetch('/api/values'),
      fetch('/api/life-domains'),
      fetch('/api/big-outcomes'),
      fetch('/api/activities'),
      fetch('/api/profile'),
      fetch('/api/map/heat'),
      fetch('/api/hopper?status=pending'),
    ])
    const [v, d, o, a, p, h, hopper] = await Promise.all([
      vRes.json(), dRes.json(), oRes.json(), aRes.json(), pRes.json(), hRes.json(), hopperRes.json(),
    ])
    if (Array.isArray(v)) setValues(v)
    if (Array.isArray(d)) setDomains(d)
    if (Array.isArray(o)) setOutcomes(o)
    if (Array.isArray(a)) setActivities(a)
    if (p && !p.error) setProfile(p)
    if (h && h.overdueActivityIds) setOverdueActivityIds(h.overdueActivityIds)
    if (Array.isArray(hopper)) setHopperCount(hopper.length)
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

      <NavBar
        displayName={displayName}
        userInitial={userInitial}
        overdueCount={overdueActivityIds.length}
        hopperCount={hopperCount}
        onOrganize={() => setOrganizeOpen(true)}
        onNewValue={() => setModal({ type: 'newValue' })}
        onNewActivity={() => setModal({ type: 'newActivity' })}
        onNewOutcome={() => setModal({ type: 'newOutcome' })}
        onNewDomain={() => setModal({ type: 'newDomain' })}
      />

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
        {mapMode === 'values' ? (
          <WildSuccessMapSVG
            values={values}
            activities={activities}
            outcomes={outcomes}
            overdueActivityIds={overdueActivityIds}
            displayName={displayName}
            onEditValue={(v) => setModal({ type: 'editValue', value: v })}
            onEditActivity={(a) => setModal({ type: 'editActivity', activity: a })}
            onEditOutcome={(o) => setModal({ type: 'editOutcome', outcome: o })}
            onAddValue={() => setModal({ type: 'newValue' })}
            onAddActivity={() => setModal({ type: 'newActivity' })}
            onAddOutcome={() => setModal({ type: 'newOutcome' })}
          />
        ) : (
          <LifeMapSVG
            values={values}
            domains={domains}
            activities={activities}
            outcomes={outcomes}
            overdueActivityIds={overdueActivityIds}
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

      {mapMode === 'values' && (
        <div style={{ borderTop: '1px solid #F0EDE6' }}>
          <TakeActionBox values={values} activities={activities} overdueActivityIds={overdueActivityIds} />
        </div>
      )}

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
          domains={domains}
          values={values}
          outcomes={outcomes}
          blockTypes={[]}
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

      {organizeOpen && (
        <OrganizeWeekModal
          onClose={() => { setOrganizeOpen(false); fetchAll() }}
          values={values}
          domains={domains}
          activities={activities}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
