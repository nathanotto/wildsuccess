-- ============================================================================
-- Migration 022: Action Items Refactor
-- Merges hopper_items + schedule_items into a single action_items table.
-- ============================================================================

-- 1.1 Create action_items table
CREATE TABLE action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  -- Identity
  name text NOT NULL,
  raw_input text,
  description text,

  -- Origin
  source text NOT NULL DEFAULT 'quick_capture'
    CHECK (source IN (
      'quick_capture', 'template_proposal', 'outside_request',
      'planning_function', 'calendar_import', 'follow_up'
    )),
  item_type text NOT NULL DEFAULT 'task'
    CHECK (item_type IN (
      'task', 'appointment', 'commitment', 'outside_request', 'tickler', 'log_entry'
    )),

  -- Lifecycle
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN (
      'candidate', 'committed', 'in_progress', 'completed',
      'parked', 'skipped', 'rescheduled', 'dismissed', 'archived'
    )),

  -- When
  proposed_date date,
  committed_date date,
  scheduled_time time without time zone,
  scheduled_end_time time without time zone,
  parked_until date,

  -- Classification
  bounding_type text DEFAULT 'action'
    CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded')),
  time_type text DEFAULT 'B'
    CHECK (time_type IN ('A', 'B', 'C', 'D', '0')),
  flexibility text DEFAULT 'anytime_this_week'
    CHECK (flexibility IN (
      'hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week'
    )),
  emotional_weight text DEFAULT 'normal'
    CHECK (emotional_weight IN ('light', 'normal', 'heavy')),
  context text[] DEFAULT '{}',

  -- Relationships
  activity_id uuid,
  task_suggestion_id uuid,
  big_outcome_id uuid,
  time_block_id uuid,
  parent_action_item_id uuid,
  person_id uuid,

  -- Priority (computed by hopper logic)
  priority_score numeric DEFAULT 0,
  priority_tier text DEFAULT 'normal'
    CHECK (priority_tier IN ('urgent', 'normal', 'suggested')),
  sort_order integer NOT NULL DEFAULT 0,

  -- Enrichment (from capture parser)
  enrichment_status text DEFAULT 'none'
    CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'confirmed', 'declined')),
  enrichment_data jsonb,
  enriched_at timestamptz,
  confirmed_at timestamptz,

  -- Proposal tracking (for template-derived items)
  last_proposed_at timestamptz,
  consecutive_dismissals integer DEFAULT 0,

  -- Commitment tracking
  committed_at timestamptz,
  committed_to_person_id uuid,

  -- Completion
  completed_at timestamptz,
  completion_note text,
  actual_duration_minutes integer,
  feelings text[],

  -- Metadata
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT action_items_pkey PRIMARY KEY (id),
  CONSTRAINT action_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT action_items_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
  CONSTRAINT action_items_task_suggestion_id_fkey FOREIGN KEY (task_suggestion_id) REFERENCES task_suggestions(id) ON DELETE SET NULL,
  CONSTRAINT action_items_big_outcome_id_fkey FOREIGN KEY (big_outcome_id) REFERENCES big_outcomes(id) ON DELETE SET NULL,
  CONSTRAINT action_items_time_block_id_fkey FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE SET NULL,
  CONSTRAINT action_items_parent_fkey FOREIGN KEY (parent_action_item_id) REFERENCES action_items(id) ON DELETE SET NULL,
  CONSTRAINT action_items_person_id_fkey FOREIGN KEY (person_id) REFERENCES known_people(id) ON DELETE SET NULL,
  CONSTRAINT action_items_committed_to_fkey FOREIGN KEY (committed_to_person_id) REFERENCES known_people(id) ON DELETE SET NULL
);

-- 1.2 RLS policies
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_select_own" ON action_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "action_items_insert_own" ON action_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "action_items_update_own" ON action_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "action_items_delete_own" ON action_items FOR DELETE USING (auth.uid() = user_id);

-- 1.3 Indexes
CREATE INDEX idx_action_items_user_id ON action_items(user_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_committed_date ON action_items(committed_date);
CREATE INDEX idx_action_items_proposed_date ON action_items(proposed_date);
CREATE INDEX idx_action_items_scheduled_time ON action_items(scheduled_time);
CREATE INDEX idx_action_items_activity_id ON action_items(activity_id);
CREATE INDEX idx_action_items_task_suggestion_id ON action_items(task_suggestion_id);
CREATE INDEX idx_action_items_parent_action_item_id ON action_items(parent_action_item_id);
CREATE INDEX idx_action_items_time_block_id ON action_items(time_block_id);
CREATE INDEX idx_action_items_person_id ON action_items(person_id);
CREATE INDEX idx_action_items_priority_score ON action_items(priority_score);
CREATE INDEX idx_action_items_time_type ON action_items(time_type);
CREATE INDEX idx_action_items_item_type ON action_items(item_type);

-- 1.4 Migrate existing data

-- Migrate schedule_items → action_items
INSERT INTO action_items (
  id, user_id, name, description, raw_input,
  source, item_type, status,
  committed_date, scheduled_time, scheduled_end_time,
  parked_until, bounding_type, time_type, flexibility,
  emotional_weight, context,
  activity_id, task_suggestion_id, time_block_id,
  sort_order, committed_at, completed_at, completion_note,
  actual_duration_minutes, metadata, created_at, updated_at
)
SELECT
  id, user_id, name, description, NULL,
  'quick_capture',
  CASE
    WHEN flexibility = 'hard_scheduled' THEN 'appointment'
    ELSE 'task'
  END,
  CASE status
    WHEN 'active' THEN 'committed'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'skipped'
    WHEN 'rescheduled' THEN 'rescheduled'
    WHEN 'parked' THEN 'parked'
    ELSE 'committed'
  END,
  scheduled_date, scheduled_time, scheduled_end_time,
  parked_until, bounding_type, time_type, flexibility,
  emotional_weight, context,
  activity_id, task_suggestion_id, time_block_id,
  sort_order, committed_at, completed_at, completion_note,
  actual_duration_minutes, NULL, created_at, updated_at
FROM schedule_items;

-- Migrate hopper_items that were NOT activated (no corresponding schedule_item)
INSERT INTO action_items (
  id, user_id, name, raw_input,
  source, item_type, status,
  proposed_date, bounding_type, time_type,
  activity_id, priority_score, priority_tier,
  enrichment_status, enrichment_data, enriched_at, confirmed_at,
  metadata, created_at, updated_at
)
SELECT
  id, user_id, raw_input, raw_input,
  source,
  CASE source
    WHEN 'outside_request' THEN 'outside_request'
    ELSE 'task'
  END,
  CASE status
    WHEN 'pending' THEN 'candidate'
    WHEN 'dismissed' THEN 'dismissed'
    WHEN 'ignored' THEN 'dismissed'
    WHEN 'archived' THEN 'archived'
    ELSE 'candidate'
  END,
  proposed_date, bounding_type, time_type,
  activity_id, priority_score, priority_tier,
  enrichment_status, enrichment_data, enriched_at, confirmed_at,
  metadata, created_at, updated_at
FROM hopper_items
WHERE status != 'activated';

-- 1.5 Update item_notes to reference action_items
ALTER TABLE item_notes ADD COLUMN action_item_id uuid;
UPDATE item_notes SET action_item_id = schedule_item_id;
ALTER TABLE item_notes ADD CONSTRAINT item_notes_action_item_id_fkey
  FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE;
ALTER TABLE item_notes DROP COLUMN schedule_item_id;
CREATE INDEX idx_item_notes_action_item_id ON item_notes(action_item_id);

-- 1.6 Update action_log to reference action_items
ALTER TABLE action_log ADD COLUMN action_item_id uuid;
UPDATE action_log SET action_item_id = schedule_item_id WHERE schedule_item_id IS NOT NULL;
UPDATE action_log SET action_item_id = hopper_item_id WHERE action_item_id IS NULL AND hopper_item_id IS NOT NULL;
ALTER TABLE action_log ADD CONSTRAINT action_log_action_item_id_fkey
  FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE SET NULL;
ALTER TABLE action_log DROP COLUMN schedule_item_id;
ALTER TABLE action_log DROP COLUMN hopper_item_id;
CREATE INDEX idx_action_log_action_item_id ON action_log(action_item_id);

-- 1.8 Drop old tables
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS hopper_items CASCADE;

-- 1.9 Action item value links
CREATE TABLE action_item_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_item_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_item_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT action_item_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_action_item_id_fkey FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES user_values(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_unique UNIQUE (action_item_id, value_id)
);

ALTER TABLE action_item_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aivl_select_own" ON action_item_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aivl_insert_own" ON action_item_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aivl_update_own" ON action_item_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aivl_delete_own" ON action_item_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_aivl_action_item_id ON action_item_value_links(action_item_id);
CREATE INDEX idx_aivl_value_id ON action_item_value_links(value_id);
