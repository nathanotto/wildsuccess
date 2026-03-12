'use client'
import { useState } from 'react'
import { Activity, UserValue, LifeDomain, BigOutcome, ValueLink, DomainLink } from '@/lib/types'

interface Props {
  activity: Activity | null
  values: UserValue[]
  domains: LifeDomain[]
  outcomes: BigOutcome[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onClose: () => void
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#2D2A26', display: 'block', marginBottom: 6 }
const fieldStyle: React.CSSProperties = { marginBottom: 16 }
const selectStyle: React.CSSProperties = { ...inputStyle, background: '#FFF' }

export default function EditActivityModal({ activity, values, domains, outcomes, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(activity?.name ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [activityType, setActivityType] = useState<'recurring' | 'one_time'>(activity?.activity_type ?? 'recurring')
  const [frequency, setFrequency] = useState(activity?.frequency ?? 'weekly')
  const [targetDate, setTargetDate] = useState(activity?.target_date ?? '')
  const [status, setStatus] = useState(activity?.status ?? 'active')
  const [isPreventive, setIsPreventive] = useState(activity?.is_preventive ?? false)
  const [domainLinks, setDomainLinks] = useState<DomainLink[]>(activity?.domain_links ?? [])
  const [bigOutcomeId, setBigOutcomeId] = useState(activity?.big_outcome_id ?? '')
  const [valueLinks, setValueLinks] = useState<ValueLink[]>(activity?.value_links ?? [])
  const [showMore, setShowMore] = useState(false)
  const [defaultDuration, setDefaultDuration] = useState(activity?.default_duration_minutes?.toString() ?? '')
  const [preferredDays, setPreferredDays] = useState(activity?.preferred_days?.join(', ') ?? '')
  const [preferredTime, setPreferredTime] = useState(activity?.preferred_time ?? '')
  const [defaultLocation, setDefaultLocation] = useState(activity?.default_location ?? '')
  const [participants, setParticipants] = useState(activity?.participants ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function toggleValueLink(valueId: string) {
    setValueLinks(prev => {
      if (prev.some(l => l.value_id === valueId)) return prev.filter(l => l.value_id !== valueId)
      return [...prev, { id: '', value_id: valueId, contribution_strength: 'moderate' }]
    })
  }

  function setStrength(valueId: string, strength: 'weak' | 'moderate' | 'strong') {
    setValueLinks(prev => prev.map(l => l.value_id === valueId ? { ...l, contribution_strength: strength } : l))
  }

  function toggleDomainLink(domainId: string, domainName: string) {
    setDomainLinks(prev => {
      if (prev.some(l => l.domain_id === domainId)) return prev.filter(l => l.domain_id !== domainId)
      return [...prev, { id: '', domain_id: domainId, domain_name: domainName }]
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!domainLinks.length) { setError('At least one Life Domain is required'); return }
    setSaving(true)
    await onSave({
      name: name.trim(), description: description || null, activity_type: activityType,
      frequency: activityType === 'recurring' ? frequency : null,
      target_date: activityType === 'one_time' ? targetDate || null : null,
      status, is_preventive: isPreventive,
      big_outcome_id: bigOutcomeId || null,
      domain_links: domainLinks.map(l => ({ domain_id: l.domain_id })),
      value_links: valueLinks.map(l => ({ value_id: l.value_id, contribution_strength: l.contribution_strength })),
      default_duration_minutes: defaultDuration ? parseInt(defaultDuration) : null,
      preferred_days: preferredDays ? preferredDays.split(',').map(s => s.trim()).filter(Boolean) : null,
      preferred_time: preferredTime || null, default_location: defaultLocation || null, participants: participants || null,
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#FFF', borderRadius: 16, padding: '32px 36px', maxWidth: 560, width: '90%', border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2D2A26', marginBottom: 20 }}>{activity ? 'Edit Activity' : 'New Activity'}</div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly budget review" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['recurring', 'one_time'] as const).map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={activityType === t} onChange={() => setActivityType(t)} style={{ accentColor: '#C4725A' }} />
                  {t === 'recurring' ? 'Recurring' : 'One-time'}
                </label>
              ))}
            </div>
          </div>
          <div>
            {activityType === 'recurring' ? (
              <>
                <label style={labelStyle}>Frequency</label>
                <select style={selectStyle} value={frequency} onChange={e => setFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual')}>
                  {['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'].map(f => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label style={labelStyle}>Target Date</label>
                <input type="date" style={inputStyle} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value as 'active' | 'aspirational' | 'paused' | 'completed')}>
              {['active', 'aspirational', 'paused', 'completed'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={isPreventive} onChange={e => setIsPreventive(e.target.checked)} style={{ accentColor: '#C4725A', width: 14, height: 14 }} />
              Preventive system
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Life Domains <span style={{ color: '#C4504A' }}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {domains.map(d => {
              const linked = domainLinks.some(l => l.domain_id === d.id)
              return (
                <button key={d.id} type="button" onClick={() => toggleDomainLink(d.id, d.name)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: linked ? '#2D2A26' : '#F8F7F4',
                    color: linked ? '#FFF' : '#2D2A26',
                    border: `1px solid ${linked ? '#2D2A26' : '#E8E4DC'}`,
                    fontWeight: linked ? 600 : 400,
                  }}>
                  {d.name}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Big Outcome</label>
          <select style={selectStyle} value={bigOutcomeId} onChange={e => setBigOutcomeId(e.target.value)}>
            <option value="">None</option>
            {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Values served</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {values.map(v => {
              const link = valueLinks.find(l => l.value_id === v.id)
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!link} onChange={() => toggleValueLink(v.id)} style={{ accentColor: '#C4725A', width: 14, height: 14, flexShrink: 0 }} />
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

        <button onClick={() => setShowMore(!showMore)} style={{ fontSize: 11, color: '#8A8578', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          {showMore ? '▲ Hide details' : '▼ More details'}
        </button>

        {showMore && (
          <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Default Duration (min)</label>
                <input type="number" style={inputStyle} value={defaultDuration} onChange={e => setDefaultDuration(e.target.value)} placeholder="e.g. 30" />
              </div>
              <div>
                <label style={labelStyle}>Preferred Time</label>
                <input style={inputStyle} value={preferredTime} onChange={e => setPreferredTime(e.target.value)} placeholder="morning / evening" />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Preferred Days (comma-separated)</label>
              <input style={inputStyle} value={preferredDays} onChange={e => setPreferredDays(e.target.value)} placeholder="Monday, Wednesday" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={defaultLocation} onChange={e => setDefaultLocation(e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Participants</label>
              <input style={inputStyle} value={participants} onChange={e => setParticipants(e.target.value)} />
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: '#C4504A', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving} style={{ background: '#C4725A', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
