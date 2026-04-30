'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS } from '@/lib/theme'

const FONT = "'Source Sans 3', sans-serif"
const BG = '#FAFAF7'
const CARD = '#FFFFFF'
const TEXT = '#2D2A26'
const MUTED = '#8A8578'
const ACCENT = COLORS.primary
const BORDER = '#E8E4DC'
const LOCKED = '#F5F2EC'

// ─── Data ─────────────────────────────────────────────────────────────────

const REQUIRED_PREVENTIVE = [
  {
    name: 'Safety',
    desc: 'Physical safety and health maintenance. Neglecting this creates crises.',
  },
  {
    name: 'Financial Sufficiency',
    desc: 'Bills paid, basics covered. The floor under everything else.',
  },
  {
    name: 'Belonging',
    desc: "Key relationships maintained. Don't let critical connections deteriorate through neglect.",
  },
]

const OPTIONAL_PREVENTIVE = [
  { name: 'Household Order', desc: 'A functional, livable home environment.' },
  { name: 'Administrative Compliance', desc: 'Taxes, insurance, registrations on time.' },
  { name: 'Professional Standing', desc: 'License, certification, professional reputation.' },
  { name: 'Digital / Data Security', desc: 'Accounts, backups, privacy protected.' },
  { name: 'Caregiving Obligations', desc: 'Dependents reliably cared for.' },
]

const PROMOTIONAL_OPTIONS = [
  'Career Advancement or Mastery',
  'Creative Expression',
  'Learning & Intellectual Growth',
  'Deepening Relationships',
  'Physical Fitness Beyond Maintenance',
  'Financial Growth Beyond Sufficiency',
  'Community Contribution',
  'Spiritual or Reflective Practice',
  'Adventure / Novelty / Play',
]

const DOMAIN_OPTIONS = [
  'Work / Livelihood',
  'Health / Body',
  'Finances',
  'Home / Household',
  'Family',
  'Partnership / Romance',
  'Friendships / Social',
  'Personal Growth / Learning',
  'Creative Life',
  'Spiritual Life',
  'Community / Civic',
  'Recreation / Fun',
]

// ─── Sub-components ───────────────────────────────────────────────────────

function CheckItem({
  name,
  desc,
  checked,
  locked,
  onChange,
}: {
  name: string
  desc: string
  checked: boolean
  locked?: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <div
      onClick={() => !locked && onChange?.(!checked)}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${checked ? ACCENT : BORDER}`,
        background: locked ? LOCKED : checked ? '#FDF6F3' : CARD,
        cursor: locked ? 'default' : 'pointer',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          border: `2px solid ${locked ? MUTED : checked ? ACCENT : '#C8C4BC'}`,
          background: checked ? (locked ? MUTED : ACCENT) : 'transparent',
          flexShrink: 0,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: locked ? MUTED : TEXT }}>
          {name}
          {locked && (
            <span style={{ marginLeft: 8, fontSize: 11, color: MUTED, fontWeight: 400 }}>
              Required
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}

function WriteIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
        fontSize: 13,
        fontFamily: FONT,
        color: TEXT,
        background: CARD,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────

export default function SetupClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1: preventive values
  const [optionalPreventive, setOptionalPreventive] = useState<Set<string>>(new Set())
  const [customPreventive, setCustomPreventive] = useState('')

  // Step 2: promotional values
  const [selectedPromo, setSelectedPromo] = useState<Set<string>>(new Set())
  const [customPromo, setCustomPromo] = useState('')

  // Step 3: life domains
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set(['Work / Livelihood', 'Health / Body', 'Finances', 'Home / Household'])
  )
  const [customDomain, setCustomDomain] = useState('')

  const toggle = <T,>(set: Set<T>, item: T): Set<T> => {
    const next = new Set(set)
    next.has(item) ? next.delete(item) : next.add(item)
    return next
  }

  async function handleComplete() {
    const preventive_values = [
      ...REQUIRED_PREVENTIVE.map(v => v.name),
      ...Array.from(optionalPreventive),
      ...(customPreventive.trim() ? [customPreventive.trim()] : []),
    ]
    const promotional_values = [
      ...Array.from(selectedPromo),
      ...(customPromo.trim() ? [customPromo.trim()] : []),
    ]
    const life_domains = [
      ...Array.from(selectedDomains),
      ...(customDomain.trim() ? [customDomain.trim()] : []),
    ]

    if (promotional_values.length < 2) {
      setError('Please select at least two promotional values.')
      return
    }
    if (life_domains.length < 4) {
      setError('Please select at least four life domains.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preventive_values, promotional_values, life_domains }),
      })
      if (!res.ok) {
        const e = await res.json()
        setError(e.error ?? 'Something went wrong.')
        return
      }
      router.push('/map')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const stepLabels = ['Protect', 'Expand', 'Domains']

  return (
    <div style={{ fontFamily: FONT, background: BG, minHeight: '100vh', color: TEXT }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: CARD, padding: '0 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>Wild Success</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: MUTED }}>Setup · Step {step} of 3</span>
            <button onClick={async () => {
              const { createClient } = await import('@/lib/supabase/client')
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{ fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Log out</button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {stepLabels.map((label, i) => {
            const s = i + 1
            const active = s === step
            const done = s < step
            return (
              <div key={s} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderBottom: `2px solid ${active ? ACCENT : done ? '#D4C4BA' : 'transparent'}` }}>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? ACCENT : done ? TEXT : MUTED }}>
                  {done ? '✓ ' : ''}{label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── Step 1: Preventive Values ── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Protect your foundation</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 24px', lineHeight: 1.5 }}>
              These values protect what you can't afford to lose. Wild Success keeps required values always visible because neglecting them tends to create emergencies that wreck everything else.
            </p>

            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Required</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {REQUIRED_PREVENTIVE.map(v => (
                <CheckItem key={v.name} name={v.name} desc={v.desc} checked locked />
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Optional — add what applies to you</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {OPTIONAL_PREVENTIVE.map(v => (
                <CheckItem
                  key={v.name}
                  name={v.name}
                  desc={v.desc}
                  checked={optionalPreventive.has(v.name)}
                  onChange={() => setOptionalPreventive(toggle(optionalPreventive, v.name))}
                />
              ))}
            </div>

            <WriteIn value={customPreventive} onChange={setCustomPreventive} placeholder="Add your own protective value..." />

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '11px 28px', borderRadius: 10, background: ACCENT,
                  color: '#fff', fontSize: 14, fontWeight: 600, border: 'none',
                  cursor: 'pointer', fontFamily: FONT,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Promotional Values ── */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>What are you reaching toward?</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 8px', lineHeight: 1.5 }}>
              Pick at least two that call to you right now — you can change these anytime.
            </p>
            <p style={{ fontSize: 12, color: selectedPromo.size < 2 ? '#C4564E' : MUTED, margin: '0 0 24px' }}>
              {selectedPromo.size} selected (minimum 2)
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {PROMOTIONAL_OPTIONS.map(name => (
                <CheckItem
                  key={name}
                  name={name}
                  desc=""
                  checked={selectedPromo.has(name)}
                  onChange={() => setSelectedPromo(toggle(selectedPromo, name))}
                />
              ))}
            </div>

            <WriteIn value={customPromo} onChange={setCustomPromo} placeholder="Add your own promotional value..." />

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep(1)}
                style={{ padding: '11px 20px', borderRadius: 10, background: 'transparent', color: MUTED, fontSize: 14, border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: FONT }}
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (selectedPromo.size + (customPromo.trim() ? 1 : 0) < 2) {
                    setError('Select at least two promotional values.')
                    return
                  }
                  setError('')
                  setStep(3)
                }}
                style={{ padding: '11px 28px', borderRadius: 10, background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: FONT }}
              >
                Next →
              </button>
            </div>
            {error && <p style={{ color: '#C4564E', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {/* ── Step 3: Life Domains ── */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Which areas of life matter to you?</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 8px', lineHeight: 1.5 }}>
              These are the areas Wild Success will help you see clearly. Some may get more attention than others — that's normal and the data will show you the pattern over time.
            </p>
            <p style={{ fontSize: 12, color: selectedDomains.size < 4 ? '#C4564E' : MUTED, margin: '0 0 24px' }}>
              {selectedDomains.size} selected (minimum 4)
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {DOMAIN_OPTIONS.map(name => (
                <div
                  key={name}
                  onClick={() => setSelectedDomains(toggle(selectedDomains, name))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${selectedDomains.has(name) ? ACCENT : BORDER}`,
                    background: selectedDomains.has(name) ? '#FDF6F3' : CARD,
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: 13,
                    fontWeight: selectedDomains.has(name) ? 600 : 400,
                    color: selectedDomains.has(name) ? TEXT : MUTED,
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: `2px solid ${selectedDomains.has(name) ? ACCENT : '#C8C4BC'}`,
                    background: selectedDomains.has(name) ? ACCENT : 'transparent',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedDomains.has(name) && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {name}
                </div>
              ))}
            </div>

            <WriteIn value={customDomain} onChange={setCustomDomain} placeholder="Add your own domain..." />

            {error && <p style={{ color: '#C4564E', fontSize: 13, marginTop: 12 }}>{error}</p>}

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => { setError(''); setStep(2) }}
                style={{ padding: '11px 20px', borderRadius: 10, background: 'transparent', color: MUTED, fontSize: 14, border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: FONT }}
              >
                ← Back
              </button>
              <button
                disabled={saving}
                onClick={handleComplete}
                style={{
                  padding: '11px 28px', borderRadius: 10,
                  background: saving ? MUTED : ACCENT,
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: FONT,
                }}
              >
                {saving ? 'Setting up your Map...' : 'Build my Map →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
