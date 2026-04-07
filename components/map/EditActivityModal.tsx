'use client'
import { useState, useEffect } from 'react'
import { Activity, UserValue, LifeDomain, BigOutcome, ValueLink, DomainLink } from '@/lib/types'

const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#D4564E', D: '#5A9E6F', '0': '#B5B0A8' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Connection', D: 'Restore', '0': 'Open' }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STRENGTH_OPTIONS = ['weak', 'moderate', 'strong'] as const
const CONTEXT_PRESETS = ['computer-home', 'phone-anywhere', 'errand-out', 'focused-quiet', 'comms-any', 'hands-free', 'outside', 'in-person']
const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

interface BlockType { id: string; name: string }

interface Props {
  activity: Activity | null
  values: UserValue[]
  domains: LifeDomain[]
  outcomes: BigOutcome[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onDelete: (() => Promise<void>) | null
  onClose: () => void
  defaultName?: string
}

export default function EditActivityModal({ activity, values, domains, outcomes, onSave, onDelete, onClose, defaultName }: Props) {
  const [name, setName] = useState(activity?.name ?? defaultName ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [activityType, setActivityType] = useState<'recurring' | 'one_time'>(activity?.activity_type ?? 'recurring')
  const [frequency, setFrequency] = useState(activity?.frequency ?? 'weekly')
  const [targetDate, setTargetDate] = useState(activity?.target_date ?? '')
  const [status, setStatus] = useState(activity?.status ?? 'active')
  const [isPreventive, setIsPreventive] = useState(activity?.is_preventive ?? false)
  const [domainLinks, setDomainLinks] = useState<DomainLink[]>(activity?.domain_links ?? [])
  const [bigOutcomeId, setBigOutcomeId] = useState(activity?.big_outcome_id ?? '')
  const [valueLinks, setValueLinks] = useState<ValueLink[]>(activity?.value_links ?? [])
  const [energyLevel, setEnergyLevel] = useState<'A' | 'B' | 'C' | 'D' | '0'>(activity?.time_type ?? 'B')
  const [emotionalWeight, setEmotionalWeight] = useState<'light' | 'normal' | 'heavy'>(activity?.emotional_weight ?? 'normal')
  const [flexibility, setFlexibility] = useState(activity?.flexibility ?? 'anytime_this_week')
  const [context, setContext] = useState<string[]>(activity?.context ?? [])
  const [contextInput, setContextInput] = useState('')
  const [preferredDays, setPreferredDays] = useState<string[]>(activity?.preferred_days ?? [])
  const [preferredTime, setPreferredTime] = useState(activity?.preferred_time ?? '')
  const [durationMin, setDurationMin] = useState(activity?.duration_range_min?.toString() ?? '')
  const [durationMax, setDurationMax] = useState(activity?.duration_range_max?.toString() ?? '')
  const [blockTypes, setBlockTypes] = useState<BlockType[]>([])
  const [blockTypeId, setBlockTypeId] = useState('')
  const [clusterable, setClusterable] = useState(activity?.clusterable ?? false)
  const [prepRequired, setPrepRequired] = useState(activity?.prep_required ?? false)
  const [prepNotes, setPrepNotes] = useState(activity?.prep_notes ?? '')
  const [dependsOnOthers, setDependsOnOthers] = useState(activity?.depends_on_others ?? false)
  const [dependencyNotes, setDependencyNotes] = useState(activity?.dependency_notes ?? '')
  const [alarmThresholdDays, setAlarmThresholdDays] = useState(activity?.alarm_threshold_days?.toString() ?? '8')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [lastCompletion, setLastCompletion] = useState<string | null>(null)
  const [logDate, setLogDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [logSaving, setLogSaving] = useState(false)

  useEffect(() => {
    fetch('/api/block-types')
      .then(r => r.ok ? r.json() : [])
      .then(data => setBlockTypes(Array.isArray(data) ? data : []))
    if (activity?.id) {
      fetch(`/api/action-log?activity_id=${activity.id}&event_type=completed&limit=1`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) setLastCompletion(data[0].event_date)
        })
    }
  }, [])

  async function handleLogCompletion() {
    if (!activity?.id || !logDate) return
    setLogSaving(true)
    try {
      const res = await fetch('/api/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'completed',
          activity_id: activity.id,
          event_date: logDate,
          note: `Logged retroactively from activity editor`,
        }),
      })
      if (res.ok) {
        setLastCompletion(logDate)
      }
    } finally {
      setLogSaving(false)
    }
  }

  function toggleDomainLink(domainId: string, domainName: string) {
    setDomainLinks(prev =>
      prev.some(l => l.domain_id === domainId)
        ? prev.filter(l => l.domain_id !== domainId)
        : [...prev, { id: '', domain_id: domainId, domain_name: domainName }]
    )
  }

  function toggleValueLink(valueId: string) {
    setValueLinks(prev =>
      prev.some(l => l.value_id === valueId)
        ? prev.filter(l => l.value_id !== valueId)
        : [...prev, { id: '', value_id: valueId, contribution_strength: 'moderate' }]
    )
  }

  function setStrength(valueId: string, strength: 'weak' | 'moderate' | 'strong') {
    setValueLinks(prev => prev.map(l => l.value_id === valueId ? { ...l, contribution_strength: strength } : l))
  }

  function toggleDay(day: string) {
    setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function addContextTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (t && !context.includes(t)) setContext(prev => [...prev, t])
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!domainLinks.length) { setError('At least one Life Domain is required'); return }
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description || null,
      activity_type: activityType,
      frequency: activityType === 'recurring' ? frequency : null,
      target_date: activityType === 'one_time' ? targetDate || null : null,
      status,
      is_preventive: isPreventive,
      alarm_threshold_days: alarmThresholdDays ? parseInt(alarmThresholdDays) : 8,
      big_outcome_id: bigOutcomeId || null,
      domain_links: domainLinks.map(l => ({ domain_id: l.domain_id })),
      value_links: valueLinks.map(l => ({ value_id: l.value_id, contribution_strength: l.contribution_strength })),
      time_type: energyLevel,
      emotional_weight: emotionalWeight,
      flexibility,
      context,
      preferred_days: preferredDays.length ? preferredDays : null,
      preferred_time: preferredTime || null,
      duration_range_min: durationMin ? parseInt(durationMin) : null,
      duration_range_max: durationMax ? parseInt(durationMax) : null,
      clusterable,
      prep_required: prepRequired,
      prep_notes: prepNotes || null,
      depends_on_others: dependsOnOthers,
      dependency_notes: dependencyNotes || null,
    })
    setSaving(false)
  }

  // ── Styles (matching EnrichmentCard exactly) ────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 12, border: '1px solid #E8E4DC', borderRadius: 6,
    padding: '5px 8px', background: '#FFF', color: '#2D2A26',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#8A857D', letterSpacing: 0.5,
    marginBottom: 4, display: 'block', textTransform: 'uppercase',
  }
  const rowStyle: React.CSSProperties = { marginBottom: 12 }
  const chip = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
    border: `1px solid ${active ? (color ?? '#4B82AF') : '#E8E4DC'}`,
    background: active ? (color ?? '#4B82AF') + '15' : 'transparent',
    color: active ? (color ?? '#4B82AF') : '#8A857D',
    fontFamily: 'inherit',
  })
  const saveBtn: React.CSSProperties = {
    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
    background: '#C4725A', color: '#FFF', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  }
  const cancelBtn: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, border: '1px solid #E8E4DC',
    background: 'transparent', color: '#8A857D', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  const actionRow = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={handleSave} disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
      <button onClick={onClose} style={cancelBtn}>Cancel</button>
      {onDelete && (
        <button
          onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false) }}
          disabled={deleting}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: '1px solid #C4504A40', background: '#FDF5F4', color: '#C4504A', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >{deleting ? '…' : 'Delete'}</button>
      )}
    </div>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,42,38,0.25)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFF', borderRadius: 16, padding: '20px 24px', maxWidth: 480, width: '90%', border: '1px solid #E8E4DC', boxShadow: '0 8px 32px rgba(45,42,38,0.12)', maxHeight: '90vh', overflowY: 'auto', fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif', fontSize: 12, color: '#2D2A26' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2D2A26', marginBottom: 12 }}>
          {activity ? 'Edit Activity' : 'New Activity'}
        </div>

        {/* Save / Cancel / Delete — top */}
        <div style={{ marginBottom: 16 }}>{actionRow}</div>

        {/* Name */}
        <div style={rowStyle}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Description */}
        <div style={rowStyle}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: 48, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Life Domain */}
        <div style={rowStyle}>
          <label style={labelStyle}>Life Domain <span style={{ color: '#C4504A' }}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {domains.map(d => (
              <button key={d.id} onClick={() => toggleDomainLink(d.id, d.name)}
                style={chip(domainLinks.some(l => l.domain_id === d.id), '#5A9E6F')}
              >{d.name}</button>
            ))}
          </div>
        </div>

        {/* Values */}
        <div style={rowStyle}>
          <label style={labelStyle}>Values</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {values.map(v => (
              <button key={v.id} onClick={() => toggleValueLink(v.id)}
                style={chip(valueLinks.some(l => l.value_id === v.id), '#9E6A46')}
              >{v.name}</button>
            ))}
          </div>
          {valueLinks.map(vl => {
            const v = values.find(v => v.id === vl.value_id)
            if (!v) return null
            return (
              <div key={vl.value_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: '#9E6A46', minWidth: 80 }}>{v.name}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {STRENGTH_OPTIONS.map(s => (
                    <button key={s} onClick={() => setStrength(vl.value_id, s)} style={chip(vl.contribution_strength === s, '#9E6A46')}>{s}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Big Outcome */}
        <div style={rowStyle}>
          <label style={labelStyle}>Big Outcome</label>
          <select style={inputStyle} value={bigOutcomeId} onChange={e => setBigOutcomeId(e.target.value)}>
            <option value="">None</option>
            {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {/* Energy / Weight */}
        <div style={{ ...rowStyle, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Energy</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['A', 'B', 'C', 'D', '0'] as const).map(e => (
                <button key={e} onClick={() => setEnergyLevel(e)} style={chip(energyLevel === e, EC[e])}>
                  {e} <span style={{ fontSize: 9 }}>{EL[e]}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Weight</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['light', 'normal', 'heavy'] as const).map(w => (
                <button key={w} onClick={() => setEmotionalWeight(w)} style={chip(emotionalWeight === w)}>
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Block Type */}
        {blockTypes.length > 0 && (
          <div style={rowStyle}>
            <label style={labelStyle}>Block Type</label>
            <select style={inputStyle} value={blockTypeId} onChange={e => setBlockTypeId(e.target.value)}>
              <option value="">None</option>
              {blockTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
            </select>
          </div>
        )}

        {/* Activity Type + Recurrence */}
        <div style={rowStyle}>
          <label style={labelStyle}>Recurrence</label>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {(['recurring', 'one_time'] as const).map(t => (
              <button key={t} onClick={() => setActivityType(t)} style={chip(activityType === t)}>
                {t === 'recurring' ? 'Recurring' : 'One-time'}
              </button>
            ))}
          </div>
          {activityType === 'recurring' && (
            <select style={inputStyle} value={frequency} onChange={e => setFrequency(e.target.value as typeof frequency)}>
              {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {activityType === 'one_time' && (
            <input type="date" style={inputStyle} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          )}
        </div>

        {/* Preferred Days */}
        <div style={rowStyle}>
          <label style={labelStyle}>Preferred Days</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => toggleDay(d)} style={chip(preferredDays.includes(d))}>{d}</button>
            ))}
          </div>
        </div>

        {/* Time of day */}
        <div style={rowStyle}>
          <label style={labelStyle}>Time of day</label>
          {flexibility === 'hard_scheduled' ? (
            <input
              type="time"
              style={inputStyle}
              value={preferredTime}
              onChange={e => setPreferredTime(e.target.value)}
            />
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              {['morning', 'afternoon', 'evening'].map(t => (
                <button key={t} onClick={() => setPreferredTime(preferredTime === t ? '' : t)} style={chip(preferredTime === t)}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Duration */}
        <div style={{ ...rowStyle, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Min minutes</label>
            <input type="number" style={inputStyle} value={durationMin} onChange={e => setDurationMin(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Max minutes</label>
            <input type="number" style={inputStyle} value={durationMax} onChange={e => setDurationMax(e.target.value)} />
          </div>
        </div>

        {/* Flexibility */}
        <div style={rowStyle}>
          <label style={labelStyle}>Flexibility</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { value: 'hard_scheduled', label: 'Hard scheduled' },
              { value: 'soft_scheduled', label: 'Soft scheduled' },
              { value: 'anytime_today', label: 'Anytime today' },
              { value: 'anytime_this_week', label: 'Anytime this week' },
            ].map(f => (
              <button key={f.value} onClick={() => setFlexibility(f.value as typeof flexibility)} style={chip(flexibility === f.value)}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Preventive */}
        <div style={{ ...rowStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsPreventive(!isPreventive)}
            style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: isPreventive ? '#C4725A' : '#E8E4DC', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 2, left: isPreventive ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#FFF', transition: 'left 0.15s' }} />
          </button>
          <span style={{ fontSize: 12, color: '#5A5650' }}>Preventive (neglecting it causes harm)</span>
        </div>

        {/* Alarm threshold — only shown for preventive activities */}
        {isPreventive && (
          <div style={{ ...rowStyle, paddingLeft: 40 }}>
            <label style={labelStyle}>Alarm after days without</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                min="1"
                style={{ ...inputStyle, width: 64 }}
                value={alarmThresholdDays}
                onChange={e => setAlarmThresholdDays(e.target.value)}
              />
              <span style={{ fontSize: 11, color: '#8A857D' }}>days — red dot on map</span>
            </div>
          </div>
        )}

        {/* Last completion + log entry */}
        {activity?.id && (
          <div style={rowStyle}>
            <label style={labelStyle}>Last Completed</label>
            <div style={{ fontSize: 12, color: '#5A5650', marginBottom: 6 }}>
              {lastCompletion
                ? new Date(lastCompletion + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : 'No record'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                style={{ ...inputStyle, width: 140 }}
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
              />
              <button
                onClick={handleLogCompletion}
                disabled={logSaving}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #5A9E6F',
                  background: '#5A9E6F10', color: '#5A9E6F', fontSize: 11, fontWeight: 600,
                  cursor: logSaving ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >{logSaving ? '...' : 'Log completion'}</button>
            </div>
          </div>
        )}

        {/* Status */}
        <div style={rowStyle}>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value as Activity['status'])}>
            {['active', 'aspirational', 'paused', 'completed'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Context Tags */}
        <div style={rowStyle}>
          <label style={labelStyle}>Context Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {CONTEXT_PRESETS.filter(p => !context.includes(p)).map(p => (
              <button key={p} onClick={() => addContextTag(p)} style={chip(false)}>+ {p}</button>
            ))}
          </div>
          {context.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {context.map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: 10, background: '#4B82AF15', color: '#4B82AF', border: '1px solid #4B82AF' }}>
                  {t}
                  <button onClick={() => setContext(prev => prev.filter(c => c !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#4B82AF', fontSize: 12, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <input
            style={{ ...inputStyle, fontSize: 11 }}
            value={contextInput}
            onChange={e => setContextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addContextTag(contextInput); setContextInput('') } }}
            onBlur={() => { if (contextInput) { addContextTag(contextInput); setContextInput('') } }}
            placeholder="Type a tag and press Enter…"
          />
        </div>

        {/* More details toggle */}
        <button
          onClick={() => setShowMore(!showMore)}
          style={{ fontSize: 10, color: '#8A857D', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit', letterSpacing: 0.3, textTransform: 'uppercase' }}
        >{showMore ? '▲ Less' : '▼ More'}</button>

        {showMore && (
          <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={clusterable} onChange={e => setClusterable(e.target.checked)} style={{ accentColor: '#C4725A' }} />
                <span><strong>Clusterable</strong> — batch with similar-context tasks</span>
              </label>
            </div>
            <div style={{ marginBottom: prepRequired ? 6 : 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={prepRequired} onChange={e => setPrepRequired(e.target.checked)} style={{ accentColor: '#C4725A' }} />
                <span><strong>Prep required</strong> before starting</span>
              </label>
            </div>
            {prepRequired && (
              <div style={{ marginBottom: 10, paddingLeft: 20 }}>
                <input style={{ ...inputStyle, fontSize: 11 }} value={prepNotes} onChange={e => setPrepNotes(e.target.value)} placeholder="What prep is needed?" />
              </div>
            )}
            <div style={{ marginBottom: dependsOnOthers ? 6 : 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={dependsOnOthers} onChange={e => setDependsOnOthers(e.target.checked)} style={{ accentColor: '#C4725A' }} />
                <span><strong>Depends on others</strong></span>
              </label>
            </div>
            {dependsOnOthers && (
              <div style={{ marginBottom: 10, paddingLeft: 20 }}>
                <input style={{ ...inputStyle, fontSize: 11 }} value={dependencyNotes} onChange={e => setDependencyNotes(e.target.value)} placeholder="Who or what does this depend on?" />
              </div>
            )}
          </div>
        )}

        {error && <div style={{ fontSize: 11, color: '#C4504A', marginBottom: 10 }}>{error}</div>}

        {/* Save / Cancel / Delete — bottom */}
        {actionRow}
      </div>
    </div>
  )
}
