'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

interface Handlers {
  onFactorChange?: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', payload: Payload) => void
  onCoaChange?: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', payload: Payload) => void
  onLinkChange?: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', payload: Payload) => void
}

export function useRealtimeMission(missionId: string, handlers: Handlers) {
  // Use refs to avoid resubscribing on every handler change
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!missionId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`mission:${missionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factors', filter: `mission_id=eq.${missionId}` },
        (payload: Payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          handlersRef.current.onFactorChange?.(eventType, payload)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coas', filter: `mission_id=eq.${missionId}` },
        (payload: Payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          handlersRef.current.onCoaChange?.(eventType, payload)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coa_factor_links' },
        (payload: Payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          handlersRef.current.onLinkChange?.(eventType, payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [missionId])
}
