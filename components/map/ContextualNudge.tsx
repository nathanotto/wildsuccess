'use client'
import { useState, useEffect } from 'react'
import type { IntakeQuestion } from '@/lib/types'
import { COLORS } from '@/lib/theme'

const FONT = "'Source Sans 3', sans-serif"
const ACCENT = COLORS.primary
const MUTED = '#8A8578'
const BORDER = '#E8E4DC'
const TEXT = '#2D2A26'

interface Props {
  questions: IntakeQuestion[]
  answeredIds: Set<string>
  onAnswer: (questionId: string, response: unknown) => Promise<void>
}

const DOMAIN_LABEL: Record<string, string> = {
  household: 'household',
  work: 'work',
  health: 'health',
  finance: 'finances',
  social: 'social life',
  growth: 'personal growth',
  rhythm: 'daily rhythm',
}

function getDismissKey(domainTag: string) {
  return `ws_nudge_dismissed_${domainTag}`
}

function isDismissed(domainTag: string): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(getDismissKey(domainTag))
  if (!stored) return false
  const dismissedAt = parseInt(stored, 10)
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - dismissedAt < sevenDays
}

function dismiss(domainTag: string) {
  localStorage.setItem(getDismissKey(domainTag), String(Date.now()))
}

export default function ContextualNudge({ questions, answeredIds, onAnswer }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [activeDomain, setActiveDomain] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Re-check dismissals on mount
    const dismissedDomains = new Set(
      Object.keys(DOMAIN_LABEL).filter(d => isDismissed(d))
    )
    setDismissed(dismissedDomains)
  }, [])

  // Find highest-priority unanswered domain
  const progressiveQuestions = questions.filter(q => !q.is_seed_question)
  const unansweredByDomain = progressiveQuestions.reduce((acc, q) => {
    if (!answeredIds.has(q.id)) {
      acc[q.domain_tag] = (acc[q.domain_tag] ?? 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // Pick first non-dismissed domain with unanswered questions
  const nudgeDomain = Object.entries(unansweredByDomain)
    .filter(([domain, count]) => count > 0 && !dismissed.has(domain))
    .sort((a, b) => b[1] - a[1])[0]

  if (!nudgeDomain) return null

  const [domain, count] = nudgeDomain
  const domainLabel = DOMAIN_LABEL[domain] ?? domain

  // Sample payoff from first unanswered question in this domain
  const samplePayoff = progressiveQuestions.find(
    q => q.domain_tag === domain && !answeredIds.has(q.id)
  )?.payoff_description ?? ''

  function handleDismiss() {
    dismiss(domain)
    setDismissed(prev => new Set([...prev, domain]))
  }

  function openModal() {
    setActiveDomain(domain)
    setShowModal(true)
  }

  const domainQuestions = progressiveQuestions.filter(
    q => q.domain_tag === activeDomain && !answeredIds.has(q.id)
  )

  async function handleSubmit(q: IntakeQuestion) {
    const val = answers[q.id]
    if (val === undefined || val === '') return
    setSubmitting(q.id)
    try {
      await onAnswer(q.id, val)
    } finally {
      setSubmitting(null)
    }
  }

  function renderInput(q: IntakeQuestion) {
    if (q.question_type === 'boolean') {
      const val = answers[q.id]
      return (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['Yes', 'No'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setAnswers(a => ({ ...a, [q.id]: opt === 'Yes' }))}
              style={{
                padding: '6px 16px', borderRadius: 7,
                border: `1px solid ${val === (opt === 'Yes') ? ACCENT : BORDER}`,
                background: val === (opt === 'Yes') ? '#FDF6F3' : '#fff',
                color: val === (opt === 'Yes') ? ACCENT : MUTED,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {opt}
            </button>
          ))}
          {val !== undefined && (
            <button
              disabled={submitting === q.id}
              onClick={() => handleSubmit(q)}
              style={{
                marginLeft: 'auto', padding: '6px 16px', borderRadius: 7,
                background: submitting === q.id ? MUTED : ACCENT,
                color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {submitting === q.id ? '...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'single_choice' && q.options) {
      const val = answers[q.id]
      return (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {q.options.map(opt => (
              <button
                key={opt}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                style={{
                  padding: '5px 12px', borderRadius: 7,
                  border: `1px solid ${val === opt ? ACCENT : BORDER}`,
                  background: val === opt ? '#FDF6F3' : '#fff',
                  color: val === opt ? ACCENT : TEXT,
                  fontSize: 12, cursor: 'pointer', fontFamily: FONT,
                  fontWeight: val === opt ? 600 : 400,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {val !== undefined && (
            <button
              disabled={submitting === q.id}
              onClick={() => handleSubmit(q)}
              style={{
                marginTop: 8, padding: '6px 16px', borderRadius: 7,
                background: submitting === q.id ? MUTED : ACCENT,
                color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {submitting === q.id ? '...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'number') {
      return (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={0}
            value={(answers[q.id] as string) ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value === '' ? undefined : Number(e.target.value) }))}
            style={{
              width: 100, padding: '7px 10px',
              borderRadius: 7, border: `1px solid ${BORDER}`,
              fontSize: 13, fontFamily: FONT, outline: 'none', color: TEXT,
            }}
          />
          {answers[q.id] !== undefined && (
            <button
              disabled={submitting === q.id}
              onClick={() => handleSubmit(q)}
              style={{
                padding: '6px 16px', borderRadius: 7,
                background: submitting === q.id ? MUTED : ACCENT,
                color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {submitting === q.id ? 'Generating...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'freetext') {
      return (
        <div style={{ marginTop: 8 }}>
          <textarea
            rows={2}
            value={(answers[q.id] as string) ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
            placeholder="Your answer..."
            style={{
              width: '100%', padding: '8px 10px',
              borderRadius: 7, border: `1px solid ${BORDER}`,
              fontSize: 12, fontFamily: FONT, resize: 'vertical',
              outline: 'none', color: TEXT, boxSizing: 'border-box',
            }}
          />
          {answers[q.id] !== undefined && (
            <button
              disabled={submitting === q.id}
              onClick={() => handleSubmit(q)}
              style={{
                marginTop: 6, padding: '6px 16px', borderRadius: 7,
                background: submitting === q.id ? MUTED : ACCENT,
                color: '#fff', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {submitting === q.id ? 'Generating...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <>
      {/* Nudge pill */}
      <div style={{
        position: 'fixed',
        bottom: 84,
        right: 24,
        zIndex: 90,
        maxWidth: 320,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 2px 12px rgba(45,42,38,0.10)',
          padding: '12px 14px',
          fontSize: 12,
          color: TEXT,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ lineHeight: 1.5 }}>
              WS has <strong>{count} question{count > 1 ? 's' : ''} about your {domainLabel}</strong> — {samplePayoff.toLowerCase().replace(/generates|creates|adds|seeds|blocks|helps|reserves|protects/i, match => match.toLowerCase())}{' '}
              <button
                onClick={openModal}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: ACCENT, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: FONT,
                  textDecoration: 'underline',
                }}
              >
                Answer now →
              </button>
            </div>
            <button
              onClick={handleDismiss}
              style={{
                background: 'none', border: 'none',
                color: MUTED, fontSize: 16, cursor: 'pointer',
                padding: '0 2px', flexShrink: 0, lineHeight: 1,
              }}
              title="Dismiss for 7 days"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Question modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(45,42,38,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            width: '100%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            margin: '0 16px',
            boxShadow: '0 8px 40px rgba(45,42,38,0.18)',
          }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: TEXT }}>
                Questions about your {domainLabel}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: MUTED, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 22px 22px' }}>
              {domainQuestions.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13, padding: '16px 0' }}>
                  All questions for this domain are answered.
                </div>
              ) : (
                domainQuestions.map((q, i) => (
                  <div key={q.id} style={{
                    padding: '14px 0',
                    borderBottom: i < domainQuestions.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}>
                    {answeredIds.has(q.id) ? (
                      <div style={{ fontSize: 12, color: '#5A9E6F' }}>✓ {q.question_text}</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{q.question_text}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{q.payoff_description}</div>
                        {renderInput(q)}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
