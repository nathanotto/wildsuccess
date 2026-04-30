'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BigOutcome, UserValue } from '@/lib/types'
import { COLORS } from '@/lib/theme'

export default function PlanNewPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [bigOutcomeId, setBigOutcomeId] = useState('')
  const [outcomes, setOutcomes] = useState<BigOutcome[]>([])
  const [values, setValues] = useState<UserValue[]>([])
  const [selectedValues, setSelectedValues] = useState<{ value_id: string; contribution_strength: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Fetch outcomes that don't already have a mission
    Promise.all([
      fetch('/api/big-outcomes').then(r => r.json()),
      fetch('/api/values').then(r => r.json()),
      fetch('/api/missions').then(r => r.json()),
    ]).then(([bos, vals, missions]) => {
      const linkedBoIds = new Set(missions.filter((m: { big_outcome_id: string | null }) => m.big_outcome_id).map((m: { big_outcome_id: string }) => m.big_outcome_id))
      setOutcomes(bos.filter((bo: BigOutcome) => !linkedBoIds.has(bo.id)))
      setValues(vals)
    })
  }, [])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        is_public: isPublic,
        big_outcome_id: bigOutcomeId || null,
        value_links: selectedValues,
      }),
    })
    if (res.ok) {
      const mission = await res.json()
      router.push(`/plan/${mission.id}/factors?kind=success`)
    }
    setSaving(false)
  }

  function toggleValue(valueId: string) {
    setSelectedValues(prev => {
      const existing = prev.find(v => v.value_id === valueId)
      if (existing) return prev.filter(v => v.value_id !== valueId)
      return [...prev, { value_id: valueId, contribution_strength: 'moderate' }]
    })
  }

  function setStrength(valueId: string, strength: string) {
    setSelectedValues(prev => prev.map(v => v.value_id === valueId ? { ...v, contribution_strength: strength } : v))
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 600, margin: '0 auto' }}>
      <button onClick={() => router.push('/plan')} style={{ background: 'none', border: 'none', color: '#8A8578', fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>
        ← Back to missions
      </button>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2A26', margin: '0 0 20px' }}>New Mission</h1>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Mission name *</label>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="What's the mission?"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of this mission…"
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          Public can view
        </label>
      </div>

      {outcomes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Link to Big Outcome</label>
          <select value={bigOutcomeId} onChange={e => setBigOutcomeId(e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            {outcomes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {values.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Link to Values</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {values.map(v => {
              const sel = selectedValues.find(sv => sv.value_id === v.id)
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => toggleValue(v.id)}
                    style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                      border: sel ? '1px solid #5A9E6F' : '1px solid #E8E4DC',
                      background: sel ? '#5A9E6F15' : 'transparent',
                      color: sel ? '#5A9E6F' : '#8A8578',
                    }}
                  >{v.name}</button>
                  {sel && (
                    <select
                      value={sel.contribution_strength}
                      onChange={e => setStrength(v.id, e.target.value)}
                      style={{ fontSize: 10, border: '1px solid #E8E4DC', borderRadius: 3, padding: '1px 2px' }}
                    >
                      <option value="strong">strong</option>
                      <option value="moderate">moderate</option>
                      <option value="weak">weak</option>
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!name.trim() || saving}
        style={{
          padding: '8px 24px', background: name.trim() ? COLORS.primary : '#E8E4DC',
          color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >{saving ? 'Saving…' : 'Save and start planning'}</button>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#2D2A26', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E4DC',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
