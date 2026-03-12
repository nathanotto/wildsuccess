export interface UserValue {
  id: string
  user_id: string
  name: string
  description: string | null
  value_type: 'preventive' | 'promotional'
  sufficiency_threshold: string | null
  sufficiency_status: string
  score: number
  sufficiency_mark: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LifeDomain {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BigOutcome {
  id: string
  user_id: string
  name: string
  description: string | null
  status: 'aspirational' | 'in_progress' | 'achieved' | 'abandoned'
  target_date: string | null
  completed_at: string | null
  completion_note: string | null
  abandonment_reason: string | null
  life_domain_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  value_links?: ValueLink[]
  activity_count?: number
}

export interface Activity {
  id: string
  user_id: string
  name: string
  description: string | null
  activity_type: 'recurring' | 'one_time'
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | null
  target_date: string | null
  status: 'active' | 'aspirational' | 'paused' | 'completed'
  is_preventive: boolean
  big_outcome_id: string | null
  default_duration_minutes: number | null
  preferred_days: string[] | null
  preferred_time: string | null
  default_location: string | null
  participants: string | null
  sort_order: number
  created_at: string
  updated_at: string
  value_links?: ValueLink[]
  domain_links?: DomainLink[]
  big_outcome_name?: string | null
}

export interface ValueLink {
  id: string
  value_id: string
  contribution_strength: 'weak' | 'moderate' | 'strong'
}

export interface DomainLink {
  id: string
  domain_id: string
  domain_name?: string | null
}

export interface ActivityLog {
  id: string
  activity_id: string
  user_id: string
  performed_at: string
  note: string | null
  duration_minutes: number | null
  created_at: string
}

export interface UserProfile {
  id: string
  display_name: string | null
  intake_status: 'not_started' | 'in_progress' | 'complete'
  intake_progress: Record<string, boolean> | null
  created_at: string
  updated_at: string
}

export interface HeatData {
  value_id: string
  heat: number
  overdue_activities: string[]
}

export interface MapData {
  values: UserValue[]
  domains: LifeDomain[]
  outcomes: BigOutcome[]
  activities: Activity[]
  profile: UserProfile | null
  heat: HeatData[]
  overdueActivityIds: string[]
}
