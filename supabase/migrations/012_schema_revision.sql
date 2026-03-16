-- 012_schema_revision.sql
-- Session 8: Waterfall values, time types, bounding types, data model cleanup

-- ─── 1. Drop legacy tables (replaced by action_log / day_reflection) ───────────

DROP TABLE IF EXISTS public.activity_log;
DROP TABLE IF EXISTS public.day_log;

-- ─── 2. Add layer to user_values ─────────────────────────────────────────────

ALTER TABLE public.user_values
  ADD COLUMN IF NOT EXISTS layer text NOT NULL DEFAULT 'security'
    CHECK (layer IN ('safety', 'security', 'freedom', 'opportunity'));

-- Assign layer to existing seed values
UPDATE public.user_values SET layer = 'safety'      WHERE name IN ('Safety', 'Health');
UPDATE public.user_values SET layer = 'security'    WHERE name IN ('Financial Sufficiency', 'Belonging');
UPDATE public.user_values SET layer = 'freedom'     WHERE name IN ('Freedom');
UPDATE public.user_values SET layer = 'opportunity' WHERE name IN ('Creative Expression', 'Purpose & Meaning', 'Adventure');

CREATE INDEX IF NOT EXISTS idx_user_values_layer ON public.user_values(layer);

-- ─── 3. Rename energy_level → time_type, expand constraint to A/B/C/D/0 ──────

-- activities
ALTER TABLE public.activities RENAME COLUMN energy_level TO time_type;
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_energy_level_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));

-- task_suggestions
ALTER TABLE public.task_suggestions RENAME COLUMN energy_level TO time_type;
ALTER TABLE public.task_suggestions DROP CONSTRAINT IF EXISTS task_suggestions_energy_level_check;
ALTER TABLE public.task_suggestions ADD CONSTRAINT task_suggestions_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));

-- time_blocks
ALTER TABLE public.time_blocks RENAME COLUMN energy_level TO time_type;
ALTER TABLE public.time_blocks DROP CONSTRAINT IF EXISTS time_blocks_energy_level_check;
ALTER TABLE public.time_blocks ADD CONSTRAINT time_blocks_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));

-- schedule_items
ALTER TABLE public.schedule_items RENAME COLUMN energy_level TO time_type;
ALTER TABLE public.schedule_items DROP CONSTRAINT IF EXISTS schedule_items_energy_level_check;
ALTER TABLE public.schedule_items ADD CONSTRAINT schedule_items_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));

-- block_types (added in 009; constraint may have explicit name)
ALTER TABLE public.block_types RENAME COLUMN energy_level TO time_type;
ALTER TABLE public.block_types DROP CONSTRAINT IF EXISTS block_types_energy_level_check;
ALTER TABLE public.block_types DROP CONSTRAINT IF EXISTS block_types_time_type_check;
ALTER TABLE public.block_types ADD CONSTRAINT block_types_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));

-- time_template_blocks (may or may not exist; was a Session 5 table)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='time_template_blocks') THEN
    ALTER TABLE public.time_template_blocks RENAME COLUMN energy_level TO time_type;
    ALTER TABLE public.time_template_blocks DROP CONSTRAINT IF EXISTS time_template_blocks_energy_level_check;
    ALTER TABLE public.time_template_blocks ADD CONSTRAINT time_template_blocks_time_type_check
      CHECK (time_type IN ('A','B','C','D','0'));
  END IF;
END $$;

-- calendar_event_classifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='calendar_event_classifications' AND column_name='energy_level') THEN
    ALTER TABLE public.calendar_event_classifications RENAME COLUMN energy_level TO time_type;
    ALTER TABLE public.calendar_event_classifications DROP CONSTRAINT IF EXISTS calendar_event_classifications_energy_level_check;
    ALTER TABLE public.calendar_event_classifications ADD CONSTRAINT calendar_event_classifications_time_type_check
      CHECK (time_type IN ('A','B','C','D','0'));
  END IF;
END $$;

-- ─── 4. Update seed_default_block_types function ──────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_default_block_types(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.block_types WHERE user_id = p_user_id;
  IF v_count > 0 THEN RETURN; END IF;

  INSERT INTO public.block_types (user_id, name, color, default_duration_minutes, time_type, icon, sort_order, is_active)
  VALUES
    (p_user_id, 'Focus',               '#C4725A', 50,  'A', '🎯', 0,  true),
    (p_user_id, 'Communicate',         '#4B82AF', 30,  'B', '💬', 1,  true),
    (p_user_id, 'Social/Family',       '#7A6BAF', 60,  'B', '👥', 2,  true),
    (p_user_id, 'Meeting/Appointment', '#9E6A46', 60,  'B', '📅', 3,  true),
    (p_user_id, 'Outing',              '#7A9E82', 120, '0', '🚶', 4,  true),
    (p_user_id, 'Admin',               '#8A857D', 45,  'B', '📋', 5,  true),
    (p_user_id, 'Recharge',            '#5A9E6F', 30,  '0', '🔋', 6,  true),
    (p_user_id, 'Ritual',              '#B8443E', 30,  'D', '🕯️', 7,  true),
    (p_user_id, 'Planning',            '#C4725A', 45,  'A', '🗺️', 8,  true),
    (p_user_id, 'Self-Care',           '#5A9E6F', 45,  'D', '🌿', 9,  true),
    (p_user_id, 'Unwanted Obligation', '#D4564E', 30,  'C', '⚡', 10, true),
    (p_user_id, 'Free Time',           '#E8E4DC', 60,  '0', '☁️', 11, true);
END;
$$;

-- ─── 5. Add bounding_type and time_type to hopper_items ──────────────────────

ALTER TABLE public.hopper_items
  ADD COLUMN IF NOT EXISTS bounding_type text DEFAULT 'action'
    CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded')),
  ADD COLUMN IF NOT EXISTS time_type text DEFAULT 'B'
    CHECK (time_type IN ('A','B','C','D','0'));

CREATE INDEX IF NOT EXISTS idx_hopper_items_time_type      ON public.hopper_items(time_type);
CREATE INDEX IF NOT EXISTS idx_hopper_items_bounding_type  ON public.hopper_items(bounding_type);

-- ─── 6. Add bounding_type to schedule_items ───────────────────────────────────

ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS bounding_type text DEFAULT 'action'
    CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded'));

ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS committed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_schedule_items_bounding_type ON public.schedule_items(bounding_type);

-- ─── 7. New table: task_suggestion_value_links ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_suggestion_value_links (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_suggestion_id   uuid NOT NULL REFERENCES public.task_suggestions(id) ON DELETE CASCADE,
  value_id             uuid NOT NULL REFERENCES public.user_values(id) ON DELETE CASCADE,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_suggestion_value_links_unique UNIQUE (task_suggestion_id, value_id)
);

ALTER TABLE public.task_suggestion_value_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tsvl_select" ON public.task_suggestion_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tsvl_insert" ON public.task_suggestion_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tsvl_update" ON public.task_suggestion_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tsvl_delete" ON public.task_suggestion_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tsvl_user_id            ON public.task_suggestion_value_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tsvl_task_suggestion_id ON public.task_suggestion_value_links(task_suggestion_id);
CREATE INDEX IF NOT EXISTS idx_tsvl_value_id           ON public.task_suggestion_value_links(value_id);

-- ─── 8. Add proposal tracking to task_suggestions ────────────────────────────

ALTER TABLE public.task_suggestions
  ADD COLUMN IF NOT EXISTS last_proposed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_dismissals integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_task_suggestions_last_proposed_at      ON public.task_suggestions(last_proposed_at);
CREATE INDEX IF NOT EXISTS idx_task_suggestions_consecutive_dismissals ON public.task_suggestions(consecutive_dismissals);

-- ─── 9. Drop life_domain_id from item-level tables ───────────────────────────

ALTER TABLE public.task_suggestions           DROP COLUMN IF EXISTS life_domain_id;
ALTER TABLE public.big_outcomes               DROP COLUMN IF EXISTS life_domain_id;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='calendar_event_classifications' AND column_name='life_domain_id') THEN
    ALTER TABLE public.calendar_event_classifications DROP COLUMN life_domain_id;
  END IF;
END $$;

-- ─── 10. Migrate one_time Activities → task_suggestions, then restrict ────────

DO $$
DECLARE
  v_activity RECORD;
  v_ts_id uuid;
BEGIN
  FOR v_activity IN
    SELECT * FROM public.activities WHERE activity_type = 'one_time'
  LOOP
    -- Create task_suggestion
    INSERT INTO public.task_suggestions (
      user_id, activity_id, name, description, recurrence,
      context, time_type, emotional_weight, duration_range_min, duration_range_max,
      flexibility, preferred_days, preferred_time, source,
      sort_order, last_completed_at, is_active, archived_at
    ) VALUES (
      v_activity.user_id, v_activity.id, v_activity.name, v_activity.description, 'one_time',
      v_activity.context, v_activity.time_type, v_activity.emotional_weight,
      v_activity.duration_range_min, v_activity.duration_range_max,
      v_activity.flexibility, v_activity.preferred_days, v_activity.preferred_time,
      'template_derived', v_activity.sort_order, null, v_activity.status = 'active',
      v_activity.archived_at
    )
    RETURNING id INTO v_ts_id;

    -- Copy value links
    INSERT INTO public.task_suggestion_value_links (user_id, task_suggestion_id, value_id, contribution_strength)
    SELECT v_activity.user_id, v_ts_id, value_id, contribution_strength
    FROM public.activity_value_links
    WHERE activity_id = v_activity.id;

    -- Set activity to recurring (placeholder) so constraint doesn't block
    UPDATE public.activities SET activity_type = 'recurring' WHERE id = v_activity.id;
  END LOOP;
END $$;

-- Now restrict activity_type to recurring only
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type = 'recurring');

-- ─── 11. Update seed_default_map_data to include layer ───────────────────────

CREATE OR REPLACE FUNCTION public.seed_default_map_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.user_values WHERE user_id = p_user_id;
  IF v_count > 0 THEN RETURN; END IF;

  INSERT INTO public.user_values (user_id, name, description, value_type, layer, sufficiency_mark, score, sort_order)
  VALUES
    (p_user_id, 'Safety',             'Physical safety, health, and shelter',           'preventive',  'safety',      8, 5, 0),
    (p_user_id, 'Health',             'Physical and mental wellbeing',                  'preventive',  'safety',      8, 5, 1),
    (p_user_id, 'Financial Sufficiency','Income, savings, and financial stability',     'preventive',  'security',    8, 4, 2),
    (p_user_id, 'Belonging',          'Close relationships and community',              'preventive',  'security',    8, 5, 3),
    (p_user_id, 'Freedom',            'Autonomy, time sovereignty, and mobility',       'promotional', 'freedom',     7, 3, 4),
    (p_user_id, 'Creative Expression','Making, building, writing, designing',           'promotional', 'opportunity', 7, 3, 5),
    (p_user_id, 'Purpose & Meaning',  'Work and contribution that matters',             'promotional', 'opportunity', 7, 3, 6),
    (p_user_id, 'Adventure',          'New experiences, travel, exploration',           'promotional', 'opportunity', 6, 2, 7);
END;
$$;
