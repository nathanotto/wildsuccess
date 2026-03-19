-- Day completion records — one per reviewed day
CREATE TABLE IF NOT EXISTS public.day_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_date date NOT NULL,
  mood            integer CHECK (mood BETWEEN 1 AND 5),
  wins            text,
  friction        text,
  journal         text,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, completion_date)
);

ALTER TABLE public.day_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_comp_select_own" ON public.day_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "day_comp_insert_own" ON public.day_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "day_comp_update_own" ON public.day_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "day_comp_delete_own" ON public.day_completions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_day_completions_updated_at
  BEFORE UPDATE ON public.day_completions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS day_comp_user_date_idx ON public.day_completions(user_id, completion_date);

-- Direct value tags on action_log entries (for items without activity_id)
ALTER TABLE public.action_log
  ADD COLUMN IF NOT EXISTS value_ids jsonb;
