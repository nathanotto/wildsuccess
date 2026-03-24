-- 024_block_types_and_spans.sql
-- Session 13: Replace 12 block types with 6, add day_spans and day_span_value_links

-- ─── 1. Replace block types ──────────────────────────────────────────────────

-- Delete all existing block types (minimal data, fresh start)
DELETE FROM public.block_types;

-- Nullify orphaned time_block references
UPDATE public.time_blocks SET block_type_id = NULL
  WHERE block_type_id IS NOT NULL
    AND block_type_id NOT IN (SELECT id FROM public.block_types);

-- ─── 2. Update seed function with 6 new block types ─────────────────────────

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
    (p_user_id, 'Desk',        '#8A857D', 60, 'B', '💻', 0, true),
    (p_user_id, 'Out',         '#7A9E82', 60, 'B', '🚶', 1, true),
    (p_user_id, 'With People', '#7A6BAF', 60, 'B', '👥', 2, true),
    (p_user_id, 'Self-Care',   '#5A9E6F', 45, 'D', '🌿', 3, true),
    (p_user_id, 'Recharge',    '#B8896E', 30, '0', '🔋', 4, true),
    (p_user_id, 'My Time',     '#4B6A82', 60, '0', '☁️', 5, true);
END;
$$;

-- Seed new block types for all existing users
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT DISTINCT user_id FROM public.user_values LOOP
    PERFORM public.seed_default_block_types(v_user.user_id);
  END LOOP;
END $$;

-- ─── 3. Create day_spans table ───────────────────────────────────────────────

CREATE TABLE public.day_spans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  person_id uuid,
  note text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_spans_pkey PRIMARY KEY (id),
  CONSTRAINT day_spans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT day_spans_person_id_fkey FOREIGN KEY (person_id) REFERENCES known_people(id) ON DELETE SET NULL,
  CONSTRAINT day_spans_date_order CHECK (end_date >= start_date)
);

ALTER TABLE public.day_spans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_spans_select_own" ON public.day_spans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "day_spans_insert_own" ON public.day_spans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "day_spans_update_own" ON public.day_spans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "day_spans_delete_own" ON public.day_spans FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_day_spans_user_id ON public.day_spans(user_id);
CREATE INDEX idx_day_spans_dates ON public.day_spans(start_date, end_date);

-- ─── 4. Create day_span_value_links table ────────────────────────────────────

CREATE TABLE public.day_span_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_span_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_span_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT day_span_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_day_span_id_fkey FOREIGN KEY (day_span_id) REFERENCES public.day_spans(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES public.user_values(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_unique UNIQUE (day_span_id, value_id)
);

ALTER TABLE public.day_span_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsvl_select_own" ON public.day_span_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dsvl_insert_own" ON public.day_span_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dsvl_update_own" ON public.day_span_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dsvl_delete_own" ON public.day_span_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dsvl_day_span_id ON public.day_span_value_links(day_span_id);
CREATE INDEX idx_dsvl_value_id ON public.day_span_value_links(value_id);
