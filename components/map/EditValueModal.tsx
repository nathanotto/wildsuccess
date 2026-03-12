'use client'
import { useState } from 'react'
import { UserValue, Activity, BigOutcome } from '@/lib/types'

interface Props {
  value: UserValue | null
  activities: Activity[]
  outcomes: BigOutcome[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 6 }
const fieldStyle: React.CSSProperties = { marginBottom: 16 }

export default function EditValueModal({ value, activities, outcomes, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(value?.name ?? '')
  const [valueType, setValueType] = useState<'preventive' | 'promotional'>(value?.value_type ?? 'preventive')
  const [score, setScore] = useState(value?.score ?? 5)
  const [sufficiencyMark, setSufficiencyMark] = useState(value?.sufficiency_mark ?? 4)
  const [sufficiencyThreshold, setSufficiencyThreshold] = useState(value?.sufficiency_threshold ?? '')
  const [description, setDescription] = useState(value?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const linkedActivities = activities.filter(a => a.value_links?.some(l => l.value_id === value?.id))
  const linkedOutcomes = outcomes.filter(o => o.value_links?.some(l => l.value_id === value?.id))

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    await onSave({ name: name.trim(), value_type: valueType, score, sufficiency_mark: sufficiencyMark, sufficiency_threshold: sufficiencyThreshold || null, description: description || null })
    setSaving(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 520, width: '90%', border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 20 }}>{value ? 'Edit Value' : 'New Value'}</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Health" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['preventive', 'promotional'] as const).map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" checked={valueType === t} onChange={() => setValueType(t)} style={{ accentColor: '#C4725A' }} />
                {t === 'preventive' ? 'Protect (Preventive)' : 'Expand (Promotional)'}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Score (1–10)</label>
            <input type="number" min={1} max={10} style={inputStyle} value={score} onChange={e => setScore(Number(e.target.value))} />
            <input type="range" min={1} max={10} value={score} onChange={e => setScore(Number(e.target.value))} style={{ width: '100%', marginTop: 6, accentColor: '#C4725A' }} />
          </div>
          <div>
            <label style={labelStyle}>Sufficiency Mark (1–10)</label>
            <input type="number" min={1} max={10} style={inputStyle} value={sufficiencyMark} onChange={e => setSufficiencyMark(Number(e.target.value))} />
            <input type="range" min={1} max={10} value={sufficiencyMark} onChange={e => setSufficiencyMark(Number(e.target.value))} style={{ width: '100%', marginTop: 6, accentColor: '#C4725A' }} />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Sufficiency Threshold</label>
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={sufficiencyThreshold} onChange={e => setSufficiencyThreshold(e.target.value)} placeholder="e.g. 6 months emergency fund" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {value && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8578', marginBottom: 6 }}>Linked activities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {linkedActivities.length === 0 ? <span style={{ fontSize: 11, color: '#C4BFB4' }}>None</span> :
                  linkedActivities.map(a => <span key={a.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F8F7F4', border: '1px solid #E8E4DC', color: '#8A8578' }}>{a.name}</span>)}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8578', marginBottom: 6 }}>Linked outcomes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {linkedOutcomes.length === 0 ? <span style={{ fontSize: 11, color: '#C4BFB4' }}>None</span> :
                  linkedOutcomes.map(o => <span key={o.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F8F7F4', border: '1px solid #E8E4DC', color: '#8A8578' }}>{o.name}</span>)}
              </div>
            </div>
          </>
        )}

        {error && <div style={{ fontSize: 12, color: '#C4504A', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} style={{ background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#2D2A26' }}>Cancel</button>
          {onDelete && <button onClick={handleDelete} disabled={deleting} style={{ marginLeft: 'auto', background: '#FDF5F4', border: '1px solid #C4504A40', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#C4504A' }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>}
        </div>
      </div>
    </div>
  )
}
