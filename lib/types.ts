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
  // Session 3 additions
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  emotional_weight: 'light' | 'normal' | 'heavy'
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  clusterable: boolean
  prep_required: boolean
  prep_notes: string | null
  depends_on_others: boolean
  dependency_notes: string | null
  duration_range_min: number | null
  duration_range_max: number | null
  source: 'template_derived' | 'user_created' | 'outside_request' | 'planning_function'
  completion_mode: 'all' | 'any' | 'sequence'
  archived_at: string | null
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

export interface TaskSuggestion {
  id: string
  user_id: string
  activity_id: string | null
  name: string
  description: string | null
  recurrence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'seasonal' | 'annual' | 'one_time' | null
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  emotional_weight: 'light' | 'normal' | 'heavy'
  duration_range_min: number | null
  duration_range_max: number | null
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  preferred_days: string[] | null
  preferred_time: string | null
  life_domain_id: string | null
  source: 'template_derived' | 'user_created' | 'outside_request' | 'planning_function'
  sort_order: number
  last_completed_at: string | null
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface TimeBlock {
  id: string
  user_id: string
  block_date: string
  label: string
  start_time: string | null
  end_time: string | null
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  is_hard: boolean
  sort_order: number
  source: 'manual' | 'time_template' | 'calendar_import'
  created_at: string
  updated_at: string
}

export interface ActionLog {
  id: string
  user_id: string
  event_type: 'proposed' | 'scheduled' | 'committed' | 'rescheduled' | 'removed' | 'completed' | 'skipped' | 'captured' | 'dismissed'
  schedule_item_id: string | null
  hopper_item_id: string | null
  activity_id: string | null
  task_suggestion_id: string | null
  event_date: string
  note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DayReflection {
  id: string
  user_id: string
  reflection_date: string
  mood_energy: number | null
  journal_note: string | null
  plan_status: 'open' | 'committed' | 'closed'
  committed_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  full_name: string | null
  preferred_name: string | null
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

export interface IntakeQuestion {
  id: string
  question_text: string
  question_type: 'boolean' | 'single_choice' | 'multi_choice' | 'number' | 'freetext'
  options: string[] | null
  domain_tag: string
  sort_order: number
  payoff_description: string
  is_seed_question: boolean
  created_at: string
}

export interface IntakeResponse {
  id: string
  user_id: string
  question_id: string
  response: unknown
  created_at: string
  updated_at: string
}

export interface HopperItem {
  id: string
  user_id: string
  raw_input: string
  source: 'quick_capture' | 'template_proposal' | 'outside_request' | 'planning_function'
  activity_id: string | null
  status: 'pending' | 'activated' | 'dismissed' | 'ignored' | 'archived'
  proposed_date: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  activity?: Partial<Activity>
}

export interface ScheduleItem {
  id: string
  user_id: string
  activity_id: string | null
  hopper_item_id: string | null
  name: string
  description: string | null
  scheduled_date: string
  scheduled_time: string | null
  scheduled_end_time: string | null
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today'
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  emotional_weight: 'light' | 'normal' | 'heavy'
  status: 'active' | 'completed' | 'skipped' | 'rescheduled'
  completion_note: string | null
  actual_duration_minutes: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CalendarConnection {
  id: string
  user_id: string
  provider: 'google'
  access_token: string
  refresh_token: string
  token_expires_at: string
  calendar_ids: string[]
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  external_event_id: string
  external_series_id: string | null
  calendar_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  attendees: { email: string; name: string; response_status: string }[] | null
  is_all_day: boolean
  recurrence_rule: string | null
  raw_event: Record<string, unknown> | null
  last_synced_at: string
  created_at: string
  updated_at: string
  classification?: CalendarEventClassification | null
}

export interface CalendarEventClassification {
  id: string
  user_id: string
  match_key: string
  match_type: 'series' | 'event'
  classification: 'provisional' | 'info' | 'fixed_commitment' | 'flexible_commitment'
  display_label: string | null
  energy_level: 'A' | 'B' | 'C' | null
  life_domain_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TimeTemplateBlock {
  id: string
  user_id: string
  day_of_week: number // 0=Monday, 6=Sunday
  label: string
  start_time: string
  end_time: string
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ActivitySpec {
  name: string
  description?: string
  activity_type: 'recurring' | 'one_time'
  frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | null
  context: string[]
  energy_level: 'A' | 'B' | 'C'
  emotional_weight: 'light' | 'normal' | 'heavy'
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  clusterable: boolean
  duration_range_min?: number
  duration_range_max?: number
  is_preventive: boolean
  suggested_life_domain?: string | null
  suggested_value_links?: string[]
}
