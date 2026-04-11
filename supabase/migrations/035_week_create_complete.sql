-- Week records for Complete and Create ritual

CREATE TABLE IF NOT EXISTS public.weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  create_statement text,
  complete_statement text,
  created_at_ritual timestamptz,
  completed_at_ritual timestamptz,
  organized_at timestamptz,
  deconflicted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY weeks_select ON public.weeks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY weeks_insert ON public.weeks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY weeks_update ON public.weeks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY weeks_delete ON public.weeks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX weeks_user_week_idx ON public.weeks (user_id, week_start);
