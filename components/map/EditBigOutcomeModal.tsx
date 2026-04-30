'use client'
import { useState } from 'react'
import { BigOutcome, UserValue, LifeDomain, Activity, ValueLink } from '@/lib/types'
import { COLORS } from '@/lib/theme'

interface Props {
  outcome: BigOutcome | null
  values: UserValue[]
  domains?: LifeDomain[]
  activities: Activity[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onPlanThis?: ((outcomeId: string) => void) | null
  hasMission?: boolean
  missionId?: string | null
  onClose: () => void
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 6 }
const fieldStyle: React.CSSProperties = { marginBottom: 16 }

export default function EditBigOutcomeModal({ outcome, values, domains, activities, onSave, onDelete, onPlanThis, hasMission, missionId, onClose }: Props) {
  const [name, setName] = useState(outcome?.name ?? '')
  const [description, setDescription] = useState(outcome?.description ?? '')
  const [status, setStatus] = useState(outcome?.status ?? 'aspirational')
  const [targetDate, setTargetDate] = useState(outcome?.target_date ?? '')
  const [completionNote, setCompletionNote] = useState(outcome?.completion_note ?? '')
  const [abandonmentReason, setAbandonmentReason] = useState(outcome?.abandonment_reason ?? '')
  const [valueLinks, setValueLinks] = useState<ValueLink[]>(outcome?.value_links ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const linkedActivities = activities.filter(a => a.big_outcome_id === outcome?.id)

  function toggleValueLink(valueId: string) {
    setValueLinks(prev => prev.some(l => l.value_id === valueId) ? prev.filter(l => l.value_id !== valueId) : [...prev, { id: '', value_id: valueId, contribution_strength: 'moderate' }])
  }
  function setStrength(valueId: string, strength: 'weak' | 'moderate' | 'strong') {
    setValueLinks(prev => prev.map(l => l.value_id === valueId ? { ...l, contribution_strength: strength } : l))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (status === 'abandoned' && !abandonmentReason.trim()) { setError('Abandonment reason required'); return }
    setSaving(true)
    await onSave({
      name: name.trim(), description: description || null, status, target_date: targetDate || null,
      completion_note: status === 'achieved' ? completionNote || null : null,
      abandonment_reason: status === 'abandoned' ? abandonmentReason : null,
      value_links: valueLinks.map(l => ({ value_id: l.value_id, contribution_strength: l.contribution_strength })),
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 520, width: '90%', border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 20 }}>{outcome ? 'Edit Big Outcome' : 'New Big Outcome'}</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Launch Pine Creek" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...inputStyle, background: '#FFF' }} value={status} onChange={e => setStatus(e.target.value as 'aspirational' | 'in_progress' | 'achieved' | 'abandoned')}>
              {['aspirational', 'in_progress', 'achieved', 'abandoned'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Target Date</label>
            <input type="date" style={inputStyle} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        </div>

        {status === 'achieved' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Completion Note</label>
            <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={completionNote} onChange={e => setCompletionNote(e.target.value)} />
          </div>
        )}

        {status === 'abandoned' && (
          <div style={fieldStyle}>
            <label style={{ ...labelStyle, color: '#C4504A' }}>Abandonment Reason (required)</label>
            <textarea style={{ ...inputStyle, height: 60, resize: 'vertical', borderColor: '#C4504A40' }} value={abandonmentReason} onChange={e => setAbandonmentReason(e.target.value)} />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Values served</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {values.map(v => {
              const link = valueLinks.find(l => l.value_id === v.id)
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!link} onChange={() => toggleValueLink(v.id)} style={{ accentColor: COLORS.primary, width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, flex: 1 }}>{v.name}</span>
                  {link && (
                    <select value={link.contribution_strength} onChange={e => setStrength(v.id, e.target.value as 'weak' | 'moderate' | 'strong')}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 11, background: '#FFF' }}>
                      <option value="weak">Weak</option>
                      <option value="moderate">Moderate</option>
                      <option value="strong">Strong</option>
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {outcome && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8578', marginBottom: 6 }}>Linked activities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {linkedActivities.length === 0 ? <span style={{ fontSize: 11, color: '#C4BFB4' }}>None</span> :
                linkedActivities.map(a => <span key={a.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F8F7F4', border: '1px solid #E8E4DC', color: '#8A8578' }}>{a.name}</span>)}
            </div>
          </div>
        )}

        {outcome && (
          <div style={{ marginBottom: 16 }}>
            {hasMission && missionId ? (
              <a href={`/plan/${missionId}`} style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600, textDecoration: 'none' }}>
                View Plan →
              </a>
            ) : !hasMission && onPlanThis ? (
              <button
                onClick={() => onPlanThis(outcome.id)}
                style={{
                  background: '#F8F7F4', border: `1px solid ${COLORS.primaryMuted}`, borderRadius: 6,
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, color: COLORS.primary, cursor: 'pointer',
                }}
              >Plan this</button>
            ) : null}
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: '#C4504A', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: COLORS.primary, color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} style={{ background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#2D2A26' }}>Cancel</button>
          {onDelete && <button onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false) }} disabled={deleting} style={{ marginLeft: 'auto', background: '#FDF5F4', border: '1px solid #C4504A40', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#C4504A' }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>}
        </div>
      </div>
    </div>
  )
}
