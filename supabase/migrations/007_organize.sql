-- 007_organize.sql
-- Session 4: Organize function schema

-- ─── Add completion_mode to activities ────────────────────────────────────────

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS completion_mode text DEFAULT 'any'
    CHECK (completion_mode IN ('all', 'any', 'sequence'));

-- ─── task_suggestions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id         uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  name                text NOT NULL,
  description         text,
  recurrence          text CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'seasonal', 'annual', 'one_time')),
  context             text[] DEFAULT '{}',
  energy_level        text DEFAULT 'B' CHECK (energy_level IN ('A', 'B', 'C')),
  emotional_weight    text DEFAULT 'normal' CHECK (emotional_weight IN ('light', 'normal', 'heavy')),
  duration_range_min  integer,
  duration_range_max  integer,
  flexibility         text DEFAULT 'anytime_this_week'
                        CHECK (flexibility IN ('hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week')),
  preferred_days      text[],
  preferred_time      text,
  life_domain_id      uuid REFERENCES public.life_domains(id) ON DELETE SET NULL,
  source              text DEFAULT 'user_created'
                        CHECK (source IN ('template_derived', 'user_created', 'outside_request', 'planning_function')),
  sort_order          integer NOT NULL DEFAULT 0,
  last_completed_at   timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_suggestions_select_own" ON public.task_suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "task_suggestions_insert_own" ON public.task_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_suggestions_update_own" ON public.task_suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "task_suggestions_delete_own" ON public.task_suggestions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_task_suggestions_updated_at
  BEFORE UPDATE ON public.task_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── time_blocks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_date   date NOT NULL,
  label        text NOT NULL,
  start_time   time,
  end_time     time,
  context      text[] DEFAULT '{}',
  energy_level text DEFAULT 'B' CHECK (energy_level IN ('A', 'B', 'C')),
  is_hard      boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  source       text DEFAULT 'manual' CHECK (source IN ('manual', 'time_template', 'calendar_import')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_blocks_select_own" ON public.time_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_blocks_insert_own" ON public.time_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_blocks_update_own" ON public.time_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_blocks_delete_own" ON public.time_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_time_blocks_updated_at
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Extend schedule_items ────────────────────────────────────────────────────

ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS time_block_id      uuid REFERENCES public.time_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_suggestion_id uuid REFERENCES public.task_suggestions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS committed_at       timestamptz;

-- ─── action_log (append-only) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type          text NOT NULL CHECK (event_type IN (
                        'proposed', 'scheduled', 'committed', 'rescheduled',
                        'removed', 'completed', 'skipped', 'captured', 'dismissed'
                      )),
  schedule_item_id    uuid REFERENCES public.schedule_items(id) ON DELETE SET NULL,
  hopper_item_id      uuid REFERENCES public.hopper_items(id) ON DELETE SET NULL,
  activity_id         uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  task_suggestion_id  uuid REFERENCES public.task_suggestions(id) ON DELETE SET NULL,
  event_date          date NOT NULL,
  note                text,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_log_select_own"  ON public.action_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "action_log_insert_own"  ON public.action_log FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE policies — append-only

-- ─── day_reflection ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.day_reflection (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_date  date NOT NULL,
  mood_energy      integer CHECK (mood_energy BETWEEN 1 AND 5),
  journal_note     text,
  plan_status      text NOT NULL DEFAULT 'open' CHECK (plan_status IN ('open', 'committed', 'closed')),
  committed_at     timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);

ALTER TABLE public.day_reflection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_reflection_select_own" ON public.day_reflection FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "day_reflection_insert_own" ON public.day_reflection FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "day_reflection_update_own" ON public.day_reflection FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER set_day_reflection_updated_at
  BEFORE UPDATE ON public.day_reflection
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Drop old tables ──────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.activity_log;
DROP TABLE IF EXISTS public.day_log;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS task_suggestions_user_id_idx         ON public.task_suggestions(user_id);
CREATE INDEX IF NOT EXISTS task_suggestions_activity_id_idx     ON public.task_suggestions(activity_id);
CREATE INDEX IF NOT EXISTS task_suggestions_is_active_idx       ON public.task_suggestions(is_active);
CREATE INDEX IF NOT EXISTS task_suggestions_last_completed_idx  ON public.task_suggestions(last_completed_at);
CREATE INDEX IF NOT EXISTS time_blocks_user_id_idx              ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS time_blocks_block_date_idx           ON public.time_blocks(block_date);
CREATE INDEX IF NOT EXISTS time_blocks_sort_order_idx           ON public.time_blocks(sort_order);
CREATE INDEX IF NOT EXISTS action_log_user_id_idx               ON public.action_log(user_id);
CREATE INDEX IF NOT EXISTS action_log_event_date_idx            ON public.action_log(event_date);
CREATE INDEX IF NOT EXISTS action_log_event_type_idx            ON public.action_log(event_type);
CREATE INDEX IF NOT EXISTS action_log_schedule_item_id_idx      ON public.action_log(schedule_item_id);
CREATE INDEX IF NOT EXISTS action_log_activity_id_idx           ON public.action_log(activity_id);
CREATE INDEX IF NOT EXISTS day_reflection_user_id_idx           ON public.day_reflection(user_id);
CREATE INDEX IF NOT EXISTS day_reflection_date_idx              ON public.day_reflection(reflection_date);
CREATE INDEX IF NOT EXISTS schedule_items_time_block_id_idx     ON public.schedule_items(time_block_id);
CREATE INDEX IF NOT EXISTS schedule_items_task_suggestion_idx   ON public.schedule_items(task_suggestion_id);
CREATE INDEX IF NOT EXISTS schedule_items_committed_at_idx      ON public.schedule_items(committed_at);
