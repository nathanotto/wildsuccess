'use client'
import { useState, useEffect, useCallback } from 'react'
import { UserValue, LifeDomain, BigOutcome, Activity, UserProfile } from '@/lib/types'
import WildSuccessMapSVG from './WildSuccessMapSVG'
import NavBar from './NavBar'
import TakeActionBox from './TakeActionBox'
import EditValueModal from './EditValueModal'
import EditActivityModal from './EditActivityModal'
import EditBigOutcomeModal from './EditBigOutcomeModal'
import EditDomainModal from './EditDomainModal'
import Toast from './Toast'

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

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchAll = useCallback(async () => {
    const [vRes, dRes, oRes, aRes, pRes, hRes] = await Promise.all([
      fetch('/api/values'),
      fetch('/api/life-domains'),
      fetch('/api/big-outcomes'),
      fetch('/api/activities'),
      fetch('/api/profile'),
      fetch('/api/map/heat'),
    ])
    const [v, d, o, a, p, h] = await Promise.all([
      vRes.json(), dRes.json(), oRes.json(), aRes.json(), pRes.json(), hRes.json(),
    ])
    if (Array.isArray(v)) setValues(v)
    if (Array.isArray(d)) setDomains(d)
    if (Array.isArray(o)) setOutcomes(o)
    if (Array.isArray(a)) setActivities(a)
    if (p && !p.error) setProfile(p)
    if (h && h.overdueActivityIds) setOverdueActivityIds(h.overdueActivityIds)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const displayName = profile?.display_name || userEmail.split('@')[0] || 'You'
  const userInitial = displayName[0].toUpperCase()

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
        onNewValue={() => setModal({ type: 'newValue' })}
        onNewActivity={() => setModal({ type: 'newActivity' })}
        onNewOutcome={() => setModal({ type: 'newOutcome' })}
        onNewDomain={() => setModal({ type: 'newDomain' })}
      />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
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
      </div>

      <div style={{ borderTop: '1px solid #F0EDE6' }}>
        <TakeActionBox values={values} activities={activities} overdueActivityIds={overdueActivityIds} />
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

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
