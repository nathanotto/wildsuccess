'use client'
import { useState, useRef, useCallback } from 'react'

interface ActionToastState {
  id: string
  msg: string
  type: 'success' | 'error'
}

export function useActionToast(duration = 3500) {
  const [toast, setToast] = useState<ActionToastState | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((id: string, msg: string, type: 'success' | 'error' = 'success') => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id, msg, type })
    setVisible(true)
    timer.current = setTimeout(() => setVisible(false), duration)
  }, [duration])

  return { toast, visible, show }
}
