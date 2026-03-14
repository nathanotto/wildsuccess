'use client'
import { useState } from 'react'

const EC: Record<string, string> = { A: '#C4725A', B: '#4B82AF', C: '#7A9E82' }
const EL: Record<string, string> = { A: 'Focus', B: 'Routine', C: 'Easy' }
const WL: Record<string, string> = { light: 'Light', normal: 'Normal', heavy: 'Heavy' }
const FL: Record<string, string> = {
  hard_scheduled: 'Hard scheduled', soft_scheduled: 'Soft scheduled',
  anytime_today: 'Anytime today', anytime_this_week: 'Anytime this week',
}

interface EnrichmentData {
  match_type: 'existing_template' | 'new_template'
  matched_activity_id: string | null
  matched_activity_name: string | null
  suggested_name: string
  suggested_description: string | null
  suggested_life_domain_id: string | null
  suggested_life_domain_name: string | null
  suggested_value_links: Array<{ value_id: string; value_name: string; contribution_strength: string }>
  suggested_big_outcome_id: string | null
  suggested_big_outcome_name: string | null
  suggested_energy_level: 'A' | 'B' | 'C'
  suggested_emotional_weight: 'light' | 'normal' | 'heavy'
  suggested_context: string[]
  suggested_block_type_id: string | null
  suggested_block_type_name: string | null
  suggested_recurrence: string | null
  suggested_preferred_days: string[] | null
  suggested_preferred_time: string | null
  suggested_duration_min: number | null
  suggested_duration_max: number | null
  suggested_flexibility: string
  suggested_is_preventive: boolean
  confidence: number
  reasoning: string
}

interface Domain { id: string; name: string }
interface Value { id: string; name: string }
interface Outcome { id: string; name: string }
interface BlockType { id: string; name: string }

interface Props {
  hopperItemId: string
  enrichmentData: EnrichmentData
  domains: Domain[]
  values: Value[]
  outcomes: Outcome[]
  blockTypes: BlockType[]
  onConfirm: (hopperItemId: string, data: EnrichmentData) => void
  onDecline: (hopperItemId: string) => void
  defaultExpanded?: boolean
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const RECURRENCE_OPTIONS = [
  { value: '', label: 'None / one-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]
const STRENGTH_OPTIONS = ['weak', 'moderate', 'strong'] as const

export default function EnrichmentCard({
  hopperItemId, enrichmentData, domains, values, outcomes, blockTypes,
  onConfirm, onDecline, defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [ed, setEd] = useState<EnrichmentData>({ ...enrichmentData })
  const isMatch = ed.match_type === 'existing_template' && ed.matched_activity_id

  function update(patch: Partial<EnrichmentData>) {
    setEd(prev => ({ ...prev, ...patch }))
  }

  function toggleValueLink(valueId: string, valueName: string) {
    const exists = ed.suggested_value_links.find(vl => vl.value_id === valueId)
    if (exists) {
      update({ suggested_value_links: ed.suggested_value_links.filter(vl => vl.value_id !== valueId) })
    } else {
      update({ suggested_value_links: [...ed.suggested_value_links, { value_id: valueId, value_name: valueName, contribution_strength: 'moderate' }] })
    }
  }

  function setStrength(valueId: string, strength: string) {
    update({
      suggested_value_links: ed.suggested_value_links.map(vl =>
        vl.value_id === valueId ? { ...vl, contribution_strength: strength } : vl
      ),
    })
  }

  function toggleDay(day: string) {
    const days = ed.suggested_preferred_days ?? []
    update({
      suggested_preferred_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day],
    })
  }

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1.5px solid #E8E4DC',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '12px 16px',
    maxWidth: defaultExpanded ? 'none' : 320,
    fontFamily: '"Source Sans 3", "Source Sans Pro", sans-serif',
    fontSize: 12,
    color: '#2D2A26',
    position: 'relative',
  }

  // ── Compact card ────────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div style={cardStyle}>
        {/* Dismiss */}
        <button
          onClick={() => onDecline(hopperItemId)}
          style={{
            position: 'absolute', top: 8, right: 10,
            width: 20, height: 20, borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer',
            fontSize: 14, color: '#B5B0A8', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Dismiss enrichment"
        >×</button>

        {/* Header */}
        <div style={{ marginBottom: 8, paddingRight: 20 }}>
          {isMatch ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#7F77DD' }}>
              ◈ Matches: {ed.matched_activity_name}
            </span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#BA7517' }}>
              ✦ New: {ed.suggested_name}
            </span>
          )}
        </div>

        {/* Summary row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {ed.suggested_life_domain_name && (
            <span style={{ fontSize: 11, color: '#8A857D' }}>
              📁 {ed.suggested_life_domain_name}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: EC[ed.suggested_energy_level], display: 'inline-block' }} />
            {EL[ed.suggested_energy_level]}
          </span>
          {(ed.suggested_duration_min || ed.suggested_duration_max) && (
            <span style={{ fontSize: 11, color: '#8A857D' }}>
              {ed.suggested_duration_min === ed.suggested_duration_max
                ? `${ed.suggested_duration_min}m`
                : `${ed.suggested_duration_min ?? '?'}–${ed.suggested_duration_max ?? '?'}m`}
            </span>
          )}
        </div>

        {/* Value tags */}
        {ed.suggested_value_links.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {ed.suggested_value_links.slice(0, 3).map(vl => (
              <span key={vl.value_id} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4,
                background: '#9E6A4610', color: '#9E6A46',
              }}>{vl.value_name}</span>
            ))}
          </div>
        )}

        {/* Recurrence + preventive */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          {ed.suggested_recurrence && (
            <span style={{ fontSize: 10, color: '#8A857D' }}>
              {ed.suggested_recurrence}{ed.suggested_preferred_time ? ` · ${ed.suggested_preferred_time}` : ''}
            </span>
          )}
          {ed.suggested_is_preventive && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#C4725A15', color: '#C4725A', fontWeight: 600 }}>
              Preventive
            </span>
          )}
          {ed.suggested_block_type_name && (
            <span style={{ fontSize: 9, color: '#B5B0A8' }}>
              🕐 {ed.suggested_block_type_name}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onConfirm(hopperItemId, ed)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: '#C4725A', color: '#FFF',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Confirm</button>
          <button
            onClick={() => setExpanded(true)}
            style={{
              padding: '6px 8px', border: 'none', background: 'transparent',
              fontSize: 12, color: '#8A857D', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >See details</button>
        </div>
      </div>
    )
  }

  // ── Expanded details ─────────────────────────────────────────────────────────
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
  const chipStyle = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
    border: `1px solid ${active ? (color ?? '#4B82AF') : '#E8E4DC'}`,
    background: active ? (color ?? '#4B82AF') + '15' : 'transparent',
    color: active ? (color ?? '#4B82AF') : '#8A857D',
    fontFamily: 'inherit',
  })

  return (
    <div style={{ ...cardStyle, maxWidth: defaultExpanded ? 'none' : 380 }}>
      <button
        onClick={() => onDecline(hopperItemId)}
        style={{
          position: 'absolute', top: 8, right: 10,
          width: 20, height: 20, borderRadius: 4, border: 'none',
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: '#B5B0A8', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >×</button>

      <div style={{ fontSize: 13, fontWeight: 600, color: isMatch ? '#7F77DD' : '#BA7517', marginBottom: 12, paddingRight: 24 }}>
        {isMatch ? `◈ Matches: ${ed.matched_activity_name}` : '✦ New template'}
      </div>

      {/* Name */}
      <div style={rowStyle}>
        <label style={labelStyle}>Name</label>
        <input style={inputStyle} value={ed.suggested_name} onChange={e => update({ suggested_name: e.target.value })} />
      </div>

      {/* Unmatch option for path 1 */}
      {isMatch && (
        <div style={{ ...rowStyle, fontSize: 11, color: '#8A857D' }}>
          <button
            onClick={() => update({ match_type: 'new_template', matched_activity_id: null, matched_activity_name: null })}
            style={{ fontSize: 11, color: '#8A857D', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}
          >This is something new (don&apos;t link to template)</button>
        </div>
      )}

      {/* Life Domain */}
      <div style={rowStyle}>
        <label style={labelStyle}>Life Domain</label>
        <select style={inputStyle} value={ed.suggested_life_domain_id ?? ''} onChange={e => {
          const d = domains.find(d => d.id === e.target.value)
          update({ suggested_life_domain_id: e.target.value || null, suggested_life_domain_name: d?.name ?? null })
        }}>
          <option value="">None</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Values */}
      <div style={rowStyle}>
        <label style={labelStyle}>Values</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {values.map(v => {
            const linked = ed.suggested_value_links.find(vl => vl.value_id === v.id)
            return (
              <button key={v.id} onClick={() => toggleValueLink(v.id, v.name)}
                style={chipStyle(!!linked, '#9E6A46')}>
                {v.name}
              </button>
            )
          })}
        </div>
        {ed.suggested_value_links.map(vl => (
          <div key={vl.value_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: '#9E6A46', minWidth: 80 }}>{vl.value_name}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {STRENGTH_OPTIONS.map(s => (
                <button key={s} onClick={() => setStrength(vl.value_id, s)}
                  style={chipStyle(vl.contribution_strength === s, '#9E6A46')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Big Outcome */}
      <div style={rowStyle}>
        <label style={labelStyle}>Big Outcome</label>
        <select style={inputStyle} value={ed.suggested_big_outcome_id ?? ''} onChange={e => {
          const o = outcomes.find(o => o.id === e.target.value)
          update({ suggested_big_outcome_id: e.target.value || null, suggested_big_outcome_name: o?.name ?? null })
        }}>
          <option value="">None</option>
          {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {/* Energy / Weight / Preventive */}
      <div style={{ ...rowStyle, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Energy</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['A', 'B', 'C'] as const).map(e => (
              <button key={e} onClick={() => update({ suggested_energy_level: e })}
                style={chipStyle(ed.suggested_energy_level === e, EC[e])}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Weight</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['light', 'normal', 'heavy'] as const).map(w => (
              <button key={w} onClick={() => update({ suggested_emotional_weight: w })}
                style={chipStyle(ed.suggested_emotional_weight === w)}>
                {WL[w]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Block Type */}
      <div style={rowStyle}>
        <label style={labelStyle}>Block Type</label>
        <select style={inputStyle} value={ed.suggested_block_type_id ?? ''} onChange={e => {
          const bt = blockTypes.find(bt => bt.id === e.target.value)
          update({ suggested_block_type_id: e.target.value || null, suggested_block_type_name: bt?.name ?? null })
        }}>
          <option value="">None</option>
          {blockTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
        </select>
      </div>

      {/* Recurrence */}
      <div style={rowStyle}>
        <label style={labelStyle}>Recurrence</label>
        <select style={inputStyle} value={ed.suggested_recurrence ?? ''}
          onChange={e => update({ suggested_recurrence: e.target.value || null })}>
          {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Preferred Days */}
      <div style={rowStyle}>
        <label style={labelStyle}>Preferred Days</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              style={chipStyle((ed.suggested_preferred_days ?? []).includes(d))}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Time of day */}
      <div style={rowStyle}>
        <label style={labelStyle}>Time of day</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {['morning', 'afternoon', 'evening'].map(t => (
            <button key={t} onClick={() => update({ suggested_preferred_time: ed.suggested_preferred_time === t ? null : t })}
              style={chipStyle(ed.suggested_preferred_time === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div style={{ ...rowStyle, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Min minutes</label>
          <input type="number" style={inputStyle} value={ed.suggested_duration_min ?? ''}
            onChange={e => update({ suggested_duration_min: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Max minutes</label>
          <input type="number" style={inputStyle} value={ed.suggested_duration_max ?? ''}
            onChange={e => update({ suggested_duration_max: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>

      {/* Flexibility */}
      <div style={rowStyle}>
        <label style={labelStyle}>Flexibility</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(FL).map(([k, v]) => (
            <button key={k} onClick={() => update({ suggested_flexibility: k })}
              style={chipStyle(ed.suggested_flexibility === k)}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Preventive toggle */}
      <div style={{ ...rowStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => update({ suggested_is_preventive: !ed.suggested_is_preventive })}
          style={{
            width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
            background: ed.suggested_is_preventive ? '#C4725A' : '#E8E4DC',
            position: 'relative', transition: 'background 0.15s', flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: ed.suggested_is_preventive ? 16 : 2,
            width: 14, height: 14, borderRadius: '50%', background: '#FFF',
            transition: 'left 0.15s',
          }} />
        </button>
        <span style={{ fontSize: 12, color: '#5A5650' }}>Preventive (neglecting it causes harm)</span>
      </div>

      {/* Reasoning */}
      <div style={{ fontSize: 10, color: '#B5B0A8', marginBottom: 12, fontStyle: 'italic' }}>
        {ed.reasoning}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onConfirm(hopperItemId, ed)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
            background: '#C4725A', color: '#FFF',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Save</button>
        <button
          onClick={() => setExpanded(false)}
          style={{
            padding: '7px 14px', borderRadius: 8, border: '1px solid #E8E4DC',
            background: 'transparent', color: '#8A857D',
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}
