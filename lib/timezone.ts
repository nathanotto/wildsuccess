import { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_TZ = 'America/Denver'

/**
 * Get today's date (YYYY-MM-DD) in the given IANA timezone.
 */
export function localDateInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Get a date offset from today in the given timezone.
 * Positive = future, negative = past.
 */
export function localDateOffsetInTz(tz: string, days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Fetch the user's timezone from their profile. Falls back to America/Denver.
 */
export async function getUserTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_profiles')
    .select('timezone')
    .eq('id', userId)
    .single()
  return data?.timezone ?? DEFAULT_TZ
}

/**
 * Get today's date string in the user's timezone. Convenience wrapper.
 */
export async function getUserToday(supabase: SupabaseClient, userId: string): Promise<string> {
  const tz = await getUserTimezone(supabase, userId)
  return localDateInTz(tz)
}
