'use client'
import { useState } from 'react'
import { LifeDomain, Activity, UserValue } from '@/lib/types'

interface Props {
  domain: LifeDomain | null
  activities: Activity[]
  values: UserValue[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onClose: () => void
}

const SWATCHES = ['#C4725A', '#5A9E6F', '#3A7CB8', '#9E6A46', '#C4504A', '#8A5FC4', '#C4A82A', '#8A8578']
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 6 }
const fieldStyle: React.CSSProperties = { marginBottom: 16 }

export default function EditDomainModal({ domain, activities, values, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(domain?.name ?? '')
  const [color, setColor] = useState(domain?.color ?? '#C4725A')
  const [description, setDescription] = useState(domain?.description ?? '')
  const [isActive, setIsActive] = useState(domain?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const domainActivities = activities.filter(a => a.life_domain_id === domain?.id)
  const servedValueIds = new Set(domainActivities.flatMap(a => a.value_links?.map(l => l.value_id) ?? []))
  const servedValues = values.filter(v => servedValueIds.has(v.id))

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    await onSave({ name: name.trim(), color: color || null, description: description || null, is_active: isActive })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 480, width: '90%', border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 20 }}>{domain ? 'Edit Life Domain' : 'New Life Domain'}</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Health" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {SWATCHES.map(s => (
              <div key={s} onClick={() => setColor(s)} style={{ width: 24, height: 24, borderRadius: '50%', background: s, cursor: 'pointer', border: color === s ? '2px solid #2D2A26' : '2px solid transparent' }} />
            ))}
            <input type="text" value={color} onChange={e => setColor(e.target.value)} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid #E8E4DC', fontSize: 12, fontFamily: 'monospace' }} placeholder="#hex" />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ accentColor: '#C4725A', width: 14, height: 14 }} />
            Active
          </label>
        </div>

        {domain && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#8A8578', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{domainActivities.length}</span> {domainActivities.length === 1 ? 'activity' : 'activities'}
            </div>
            {servedValues.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8578', marginBottom: 6 }}>Values served</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {servedValues.map(v => <span key={v.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#F8F7F4', border: '1px solid #E8E4DC', color: '#8A8578' }}>{v.name}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: '#C4504A', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} style={{ background: '#F8F7F4', border: '1px solid #E8E4DC', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#2D2A26' }}>Cancel</button>
          {onDelete && (
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#8A8578' }}>Activities will become unassigned.</div>
              <button onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false) }} disabled={deleting} style={{ background: '#FDF5F4', border: '1px solid #C4504A40', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#C4504A' }}>
                {deleting ? 'Deleting...' : 'Delete Domain'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
