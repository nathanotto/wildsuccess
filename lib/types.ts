export interface UserValue {
  id: string
  user_id: string
  name: string
  description: string | null
  value_type: 'preventive' | 'promotional'
  layer: 'safety' | 'security' | 'freedom' | 'opportunity'
  sufficiency_threshold: string | null
  sufficiency_status: string
  score: number
  sufficiency_mark: number
  sort_order: number
  is_active: boolean
  position_x: number | null
  position_y: number | null
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
  position_x: number | null
  position_y: number | null
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
  activity_type: 'recurring'
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
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  clusterable: boolean
  prep_required: boolean
  prep_notes: string | null
  depends_on_others: boolean
  dependency_notes: string | null
  duration_range_min: number | null
  duration_range_max: number | null
  alarm_threshold_days: number
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
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  duration_range_min: number | null
  duration_range_max: number | null
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  preferred_days: string[] | null
  preferred_time: string | null
  source: 'template_derived' | 'user_created' | 'outside_request' | 'planning_function'
  sort_order: number
  last_completed_at: string | null
  last_proposed_at: string | null
  consecutive_dismissals: number
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskSuggestionValueLink {
  id: string
  user_id: string
  task_suggestion_id: string
  value_id: string
  contribution_strength: 'weak' | 'moderate' | 'strong'
  created_at: string
}

export interface TimeBlock {
  id: string
  user_id: string
  block_date: string
  label: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  focus_override_minutes: 25 | 50 | 75 | null
  block_type_id: string | null
  context: string[]
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  is_hard: boolean
  sort_order: number
  source: 'manual' | 'time_template' | 'calendar_import'
  created_at: string
  updated_at: string
}

export interface ActionLog {
  id: string
  user_id: string
  event_type: 'proposed' | 'scheduled' | 'committed' | 'rescheduled' | 'removed' | 'completed' | 'skipped' | 'captured' | 'dismissed' | 'reopened' | 'parked' | 'in_progress' | 'logged'
  action_item_id: string | null
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

export interface ActionItem {
  id: string
  user_id: string
  name: string
  raw_input: string | null
  description: string | null
  source: 'quick_capture' | 'template_proposal' | 'outside_request' | 'planning_function' | 'calendar_import' | 'follow_up'
  item_type: 'task' | 'appointment' | 'commitment' | 'outside_request' | 'tickler' | 'log_entry'
  status: 'candidate' | 'committed' | 'in_progress' | 'completed' | 'parked' | 'skipped' | 'rescheduled' | 'dismissed' | 'archived'
  proposed_date: string | null
  committed_date: string | null
  scheduled_time: string | null
  scheduled_end_time: string | null
  parked_until: string | null
  bounding_type: 'time' | 'action' | 'outcome' | 'unbounded'
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  emotional_weight: 'light' | 'normal' | 'heavy'
  context: string[]
  activity_id: string | null
  task_suggestion_id: string | null
  big_outcome_id: string | null
  time_block_id: string | null
  parent_action_item_id: string | null
  person_id: string | null
  priority_score: number
  priority_tier: 'urgent' | 'normal' | 'suggested'
  sort_order: number
  enrichment_status: 'none' | 'pending' | 'enriched' | 'confirmed' | 'declined'
  enrichment_data: Record<string, unknown> | null
  enriched_at: string | null
  confirmed_at: string | null
  last_proposed_at: string | null
  consecutive_dismissals: number
  committed_at: string | null
  committed_to_person_id: string | null
  completed_at: string | null
  completion_note: string | null
  actual_duration_minutes: number | null
  feelings: string[] | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  activity?: Partial<Activity>
}

export interface ItemNote {
  id: string
  user_id: string
  action_item_id: string
  note_type: 'note' | 'step'
  content: string
  is_completed: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ActionItemWithNotes extends ActionItem {
  item_notes?: ItemNote[]
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
  time_type: 'A' | 'B' | 'C' | 'D' | '0' | null
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
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BlockType {
  id: string
  user_id: string
  name: string
  color: string
  default_duration_minutes: number
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FocusSettings {
  id: string
  user_id: string
  default_focus_minutes: 25 | 50 | 75
  created_at: string
  updated_at: string
}

export interface ActivitySpec {
  name: string
  description?: string
  activity_type: 'recurring'
  frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | null
  context: string[]
  time_type: 'A' | 'B' | 'C' | 'D' | '0'
  emotional_weight: 'light' | 'normal' | 'heavy'
  flexibility: 'hard_scheduled' | 'soft_scheduled' | 'anytime_today' | 'anytime_this_week'
  clusterable: boolean
  duration_range_min?: number
  duration_range_max?: number
  is_preventive: boolean
  suggested_life_domain?: string | null
  suggested_value_links?: string[]
}
