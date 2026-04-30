'use client'
import { useState } from 'react'
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
  onClose: () => void
}

export default function SeedQuestionsModal({ questions, answeredIds, onAnswer, onClose }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)

  const unanswered = questions.filter(q => !answeredIds.has(q.id))
  const answeredCount = questions.length - unanswered.length

  async function handleSubmit(q: IntakeQuestion) {
    const val = answers[q.id]
    if (val === undefined || val === '') return

    setSubmitting(q.id)
    setGeneratingFor(q.id)
    try {
      await onAnswer(q.id, val)
    } finally {
      setSubmitting(null)
      setGeneratingFor(null)
    }
  }

  function renderInput(q: IntakeQuestion) {
    const isSubmitting = submitting === q.id
    const isGenerating = generatingFor === q.id
    const alreadyAnswered = answeredIds.has(q.id)

    if (alreadyAnswered) {
      return (
        <div style={{ fontSize: 12, color: '#5A9E6F', marginTop: 8 }}>✓ Answered — activities generated</div>
      )
    }

    if (q.question_type === 'boolean') {
      const val = answers[q.id]
      return (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {(['Yes', 'No'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setAnswers(a => ({ ...a, [q.id]: opt === 'Yes' }))}
              style={{
                padding: '7px 20px', borderRadius: 8,
                border: `1px solid ${val === (opt === 'Yes') ? ACCENT : BORDER}`,
                background: val === (opt === 'Yes') ? '#FDF6F3' : '#fff',
                color: val === (opt === 'Yes') ? ACCENT : MUTED,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {opt}
            </button>
          ))}
          {val !== undefined && (
            <button
              disabled={isSubmitting}
              onClick={() => handleSubmit(q)}
              style={{
                marginLeft: 'auto', padding: '7px 18px', borderRadius: 8,
                background: isSubmitting ? MUTED : ACCENT,
                color: '#fff', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: isSubmitting ? 'default' : 'pointer', fontFamily: FONT,
              }}
            >
              {isGenerating ? 'Generating...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'single_choice' && q.options) {
      const val = answers[q.id]
      return (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {q.options.map(opt => (
              <button
                key={opt}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                style={{
                  padding: '6px 14px', borderRadius: 8,
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
              disabled={isSubmitting}
              onClick={() => handleSubmit(q)}
              style={{
                marginTop: 10, padding: '7px 18px', borderRadius: 8,
                background: isSubmitting ? MUTED : ACCENT,
                color: '#fff', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: isSubmitting ? 'default' : 'pointer', fontFamily: FONT,
              }}
            >
              {isGenerating ? 'Generating...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'freetext') {
      return (
        <div style={{ marginTop: 10 }}>
          <textarea
            rows={2}
            value={(answers[q.id] as string) ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
            placeholder="Your answer..."
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: 8, border: `1px solid ${BORDER}`,
              fontSize: 13, fontFamily: FONT, resize: 'vertical',
              outline: 'none', color: TEXT, boxSizing: 'border-box',
            }}
          />
          {answers[q.id] !== undefined && (
            <button
              disabled={isSubmitting}
              onClick={() => handleSubmit(q)}
              style={{
                marginTop: 8, padding: '7px 18px', borderRadius: 8,
                background: isSubmitting ? MUTED : ACCENT,
                color: '#fff', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: isSubmitting ? 'default' : 'pointer', fontFamily: FONT,
              }}
            >
              {isGenerating ? 'Generating activities...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    if (q.question_type === 'number') {
      return (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <input
            type="number"
            value={(answers[q.id] as number) ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: parseFloat(e.target.value) }))}
            placeholder="0"
            style={{
              width: 80, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${BORDER}`, fontSize: 13,
              fontFamily: FONT, outline: 'none', color: TEXT,
            }}
          />
          {answers[q.id] !== undefined && (
            <button
              disabled={isSubmitting}
              onClick={() => handleSubmit(q)}
              style={{
                padding: '7px 18px', borderRadius: 8,
                background: isSubmitting ? MUTED : ACCENT,
                color: '#fff', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: isSubmitting ? 'default' : 'pointer', fontFamily: FONT,
              }}
            >
              {isGenerating ? 'Generating...' : 'Save'}
            </button>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(45,42,38,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 560,
        maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        margin: '0 16px',
        boxShadow: '0 8px 40px rgba(45,42,38,0.18)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px', color: TEXT }}>
                Your Map is ready 🎉
              </h2>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                Let's add some activities. These 8 questions will get you started — answer as many as you like.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: MUTED, padding: '0 4px', flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          {answeredCount > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#5A9E6F' }}>
              ✓ {answeredCount} of {questions.length} answered — activities are generating on your Map
            </div>
          )}
        </div>

        {/* Questions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
          {unanswered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14 }}>All questions answered. Check your Map for new activities!</div>
              <button
                onClick={onClose}
                style={{
                  marginTop: 16, padding: '10px 24px', borderRadius: 10,
                  background: ACCENT, color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                See my Map
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {unanswered.map((q, i) => (
                <div
                  key={q.id}
                  style={{
                    padding: '16px 0',
                    borderBottom: i < unanswered.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
                    {q.question_text}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
                    {q.payoff_description}
                  </div>
                  {renderInput(q)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${BORDER}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: MUTED }}>
            Unanswered questions will appear as nudges on your Map.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, background: 'transparent',
              color: MUTED, fontSize: 13, border: `1px solid ${BORDER}`,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Do this later
          </button>
        </div>
      </div>
    </div>
  )
}
