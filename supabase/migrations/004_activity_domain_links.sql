-- Replace single life_domain_id on activities with many-to-many activity_domain_links

CREATE TABLE public.activity_domain_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.life_domains(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, domain_id)
);

ALTER TABLE public.activity_domain_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity domain links"
  ON public.activity_domain_links FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX activity_domain_links_activity_id_idx ON public.activity_domain_links(activity_id);
CREATE INDEX activity_domain_links_domain_id_idx ON public.activity_domain_links(domain_id);

-- Migrate existing data
INSERT INTO public.activity_domain_links (user_id, activity_id, domain_id)
SELECT user_id, id, life_domain_id
FROM public.activities
WHERE life_domain_id IS NOT NULL;

-- Remove old column
ALTER TABLE public.activities DROP COLUMN life_domain_id;
