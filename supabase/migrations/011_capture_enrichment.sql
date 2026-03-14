-- 011_capture_enrichment.sql
-- Session 7: AI enrichment fields on hopper_items

ALTER TABLE public.hopper_items
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'none'
    CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'confirmed', 'declined')),
  ADD COLUMN IF NOT EXISTS enrichment_data jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS hopper_items_enrichment_status_idx
  ON public.hopper_items(enrichment_status);
