-- Markers table and Big Outcome closure support

-- 1a. New markers table
CREATE TABLE public.markers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  occurred_on date NOT NULL,
  subject_type text CHECK (subject_type = ANY (ARRAY['big_outcome'::text, 'mission'::text, 'coa'::text, 'life_event'::text])),
  subject_id uuid,
  subject_title_snapshot text NOT NULL,
  marker_type text NOT NULL CHECK (marker_type = ANY (ARRAY[
    'accomplished'::text,
    'declared_complete'::text,
    'closed_with_succession'::text,
    'abandoned'::text,
    'life_event'::text
  ])),
  title text NOT NULL,
  in_moment_note text,
  reflection text,
  reflection_status text NOT NULL DEFAULT 'pending'::text CHECK (reflection_status = ANY (ARRAY['pending'::text, 'reflected'::text, 'skipped'::text])),
  significance integer CHECK (significance >= 1 AND significance <= 3),
  succeeded_by_type text CHECK (succeeded_by_type IS NULL OR succeeded_by_type = ANY (ARRAY['big_outcome'::text, 'mission'::text, 'coa'::text])),
  succeeded_by_id uuid,
  linked_value_ids uuid[] DEFAULT '{}'::uuid[],
  linked_domain_ids uuid[] DEFAULT '{}'::uuid[],
  media_attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT markers_pkey PRIMARY KEY (id),
  CONSTRAINT markers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX markers_user_occurred_idx ON public.markers (user_id, occurred_on DESC);
CREATE INDEX markers_subject_idx ON public.markers (subject_type, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX markers_reflection_status_idx ON public.markers (user_id, reflection_status);

ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY markers_select ON public.markers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY markers_insert ON public.markers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY markers_update ON public.markers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY markers_delete ON public.markers FOR DELETE USING (auth.uid() = user_id);

-- 1b. New columns on big_outcomes
ALTER TABLE public.big_outcomes
  ADD COLUMN IF NOT EXISTS closure_type text CHECK (closure_type IS NULL OR closure_type = ANY (ARRAY[
    'accomplished'::text,
    'declared_complete'::text,
    'closed_with_succession'::text,
    'abandoned'::text
  ])),
  ADD COLUMN IF NOT EXISTS closed_on date,
  ADD COLUMN IF NOT EXISTS succeeds_big_outcome_id uuid REFERENCES public.big_outcomes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS succeeded_by_big_outcome_id uuid REFERENCES public.big_outcomes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS big_outcomes_closure_idx ON public.big_outcomes (user_id, closure_type) WHERE closure_type IS NOT NULL;

-- 1c. Expand the big_outcomes status enum
ALTER TABLE public.big_outcomes DROP CONSTRAINT IF EXISTS big_outcomes_status_check;
ALTER TABLE public.big_outcomes ADD CONSTRAINT big_outcomes_status_check
  CHECK (status = ANY (ARRAY[
    'aspirational'::text,
    'in_progress'::text,
    'achieved'::text,
    'declared_complete'::text,
    'closed_with_succession'::text,
    'abandoned'::text
  ]));
