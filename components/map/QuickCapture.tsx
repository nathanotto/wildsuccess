'use client'
import { useState, useRef } from 'react'
import { useActionToast } from '@/lib/useActionToast'
import ActionToast from '@/components/shared/ActionToast'
import { COLORS } from '@/lib/theme'

const FONT = "'Source Sans 3', sans-serif"
const ACCENT = COLORS.primary
const MUTED = '#8A8578'
const BORDER = '#E8E4DC'
const TEXT = '#2D2A26'

interface Props {
  onCaptured: () => void
}

export default function QuickCapture({ onCaptured }: Props) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast, visible, show } = useActionToast()

  async function handleSubmit() {
    const text = value.trim()
    if (!text) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: text, source: 'map' }),
      })
      if (!res.ok) { show('capture', 'Failed to capture', 'error'); return }

      const { parsed } = await res.json()
      const name = parsed?.cleanedName ?? text
      const label =
        parsed?.outcome === 'logged'          ? `Logged: ${name}` :
        parsed?.outcome === 'scheduled_hard'  ? `Booked: ${name}` :
        parsed?.outcome === 'scheduled_soft'  ? `Penciled in: ${name}` :
        parsed?.outcome === 'tickler'         ? `Reminder set: ${name}` :
        parsed?.outcome === 'outside_request' ? `From ${parsed.person}: ${name}` :
        parsed?.outcome === 'commitment'      ? `Committed: ${name}` :
                                                `Captured: ${name}`
      show('capture', label)
      setValue('')
      setFocused(false)
      onCaptured()
    } catch {
      show('capture', 'Failed to capture', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape') { setValue(''); setFocused(false); inputRef.current?.blur() }
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
      <div style={{ width: focused ? 440 : 320, transition: 'width 0.2s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', borderRadius: 28,
          border: `1.5px solid ${focused ? ACCENT : BORDER}`,
          boxShadow: focused ? '0 4px 24px rgba(196,114,90,0.18)' : '0 2px 12px rgba(45,42,38,0.10)',
          padding: '8px 8px 8px 18px', transition: 'all 0.2s ease',
        }}>
          <span style={{ fontSize: 14, color: MUTED, flexShrink: 0 }}>+</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => { if (!value) setFocused(false) }}
            onKeyDown={handleKeyDown}
            placeholder="Capture something..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 13,
              fontFamily: FONT, color: TEXT, background: 'transparent',
            }}
          />
          {value && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
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
              <ActionToast message={toast?.msg} visible={visible} type={toast?.type} position="above" />
            </div>
          )}
          {!value && toast && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ActionToast message={toast.msg} visible={visible} type={toast.type} position="above" />
            </div>
          )}
        </div>
        {focused && !value && (
          <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginTop: 6, pointerEvents: 'none' }}>
            Press Enter to capture · Esc to dismiss
          </div>
        )}
      </div>
    </div>
  )
}
