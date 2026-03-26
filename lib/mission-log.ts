import type { SupabaseClient } from '@supabase/supabase-js'

export async function writeMissionLog(
  supabase: SupabaseClient,
  params: {
    mission_id: string
    user_id: string
    entry_type: string
    description: string
    subject_type?: string
    subject_id?: string
  }
) {
  await supabase.from('mission_log').insert({
    mission_id: params.mission_id,
    user_id: params.user_id,
    entry_type: params.entry_type,
    description: params.description,
    subject_type: params.subject_type ?? null,
    subject_id: params.subject_id ?? null,
  })
}
