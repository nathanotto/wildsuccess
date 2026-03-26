-- 025_week_reflections.sql
-- Week-level reflection storage for /review/week

CREATE TABLE public.week_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  what_worked text,
  what_to_change text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT week_reflections_unique UNIQUE (user_id, week_start)
);

ALTER TABLE public.week_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wr_select_own" ON public.week_reflections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wr_insert_own" ON public.week_reflections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wr_update_own" ON public.week_reflections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wr_delete_own" ON public.week_reflections FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_week_reflections_user_week ON public.week_reflections(user_id, week_start);
