'use client'
import { useState, useRef } from 'react'
import EnrichmentCard from '@/components/capture/EnrichmentCard'

const FONT = "'Source Sans 3', sans-serif"
const ACCENT = '#C4725A'
const MUTED = '#8A8578'
const BORDER = '#E8E4DC'
const TEXT = '#2D2A26'

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
  onCaptured: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  domains?: Domain[]
  values?: Value[]
  outcomes?: Outcome[]
  blockTypes?: BlockType[]
}

export default function QuickCapture({
  onCaptured, showToast,
  domains = [], values = [], outcomes = [], blockTypes = [],
}: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [pendingCard, setPendingCard] = useState<{ hopperItemId: string; data: EnrichmentData } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    const text = value.trim()
    if (!text) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/hopper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: text, source: 'quick_capture' }),
      })
      if (!res.ok) { showToast('Failed to capture', 'error'); return }

      const item = await res.json()
      const preview = text.length > 40 ? text.slice(0, 40) + '…' : text
      showToast(`Captured: "${preview}"`)
      setValue('')
      setFocused(false)
      onCaptured()

      // Fire enrichment in background
      setEnriching(true)
      setPendingCard(null)
      fetch('/api/capture/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hopper_item_id: item.id }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && !data.error) {
            setPendingCard({ hopperItemId: item.id, data })
          }
        })
        .catch(() => null)
        .finally(() => setEnriching(false))
    } catch {
      showToast('Failed to capture', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm(hopperItemId: string, data: EnrichmentData) {
    setPendingCard(null)
    await fetch('/api/capture/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hopper_item_id: hopperItemId, enrichment_data: data }),
    })
    showToast('Enrichment saved')
    onCaptured()
  }

  async function handleDecline(hopperItemId: string) {
    setPendingCard(null)
    await fetch('/api/capture/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hopper_item_id: hopperItemId }),
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape') { setValue(''); setFocused(false); inputRef.current?.blur() }
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
      {/* Enrichment card */}
      {pendingCard && (
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <EnrichmentCard
            hopperItemId={pendingCard.hopperItemId}
            enrichmentData={pendingCard.data}
            domains={domains}
            values={values}
            outcomes={outcomes}
            blockTypes={blockTypes}
            onConfirm={handleConfirm}
            onDecline={handleDecline}
          />
        </div>
      )}

      {/* Capture pill */}
      <div style={{ width: focused ? 440 : 320, transition: 'width 0.2s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', borderRadius: 28,
          border: `1.5px solid ${focused ? ACCENT : BORDER}`,
          boxShadow: focused ? '0 4px 24px rgba(196,114,90,0.18)' : '0 2px 12px rgba(45,42,38,0.10)',
          padding: '8px 8px 8px 18px', transition: 'all 0.2s ease',
        }}>
          {enriching ? (
            <span style={{ fontSize: 12, color: ACCENT, flexShrink: 0, animation: 'pulse 1s infinite' }}>●</span>
          ) : (
            <span style={{ fontSize: 14, color: MUTED, flexShrink: 0 }}>+</span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => { if (!value) setFocused(false) }}
            onKeyDown={handleKeyDown}
            placeholder={enriching ? 'Enriching capture…' : 'Capture something...'}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 13,
              fontFamily: FONT, color: TEXT, background: 'transparent',
            }}
          />
          {value && (
            <button
              disabled={submitting}
              onClick={handleSubmit}
              style={{
                padding: '6px 16px', borderRadius: 20,
                background: submitting ? MUTED : ACCENT,
                color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: submitting ? 'default' : 'pointer',
                fontFamily: FONT, flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >{submitting ? '...' : 'Capture'}</button>
          )}
        </div>
        {focused && !value && (
          <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginTop: 6, pointerEvents: 'none' }}>
            Press Enter to capture · Esc to dismiss
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}
