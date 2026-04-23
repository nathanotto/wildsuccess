'use client'

interface ActionToastProps {
  message?: string | null
  visible: boolean
  type?: 'success' | 'error'
  position?: 'left' | 'right' | 'above' | 'below'
  width?: number
}

const COLORS = {
  success: { border: '#5A9E6F', text: '#2E7D32', shadow: 'rgba(90,158,111,0.4)' },
  error: { border: '#C4504A', text: '#C4504A', shadow: 'rgba(196,80,74,0.4)' },
}

const POSITIONS: Record<string, React.CSSProperties> = {
  left: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  right: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  above: { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
  below: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
}

export default function ActionToast({ message, visible, type = 'success', position = 'left', width = 200 }: ActionToastProps) {
  if (!message) return null
  const c = COLORS[type]
  return (
    <div style={{
      position: 'absolute',
      ...POSITIONS[position],
      width,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.4,
      color: c.text,
      background: '#FFF',
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: '6px 12px',
      boxShadow: `0 0 8px ${c.shadow}`,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s',
      pointerEvents: 'none',
      zIndex: 50,
    }}>{message}</div>
  )
}
