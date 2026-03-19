-- Allow 'hidden' as a valid classification (was missing from original constraint)
ALTER TABLE public.calendar_event_classifications
  DROP CONSTRAINT IF EXISTS calendar_event_classifications_classification_check;

ALTER TABLE public.calendar_event_classifications
  ADD CONSTRAINT calendar_event_classifications_classification_check
  CHECK (classification IN ('provisional', 'info', 'fixed_commitment', 'flexible_commitment', 'hidden'));

-- Fingerprint of the Google event at time of suppression (title|start_time|end_time).
-- If the event changes in Google, the fingerprint won't match and the event reappears.
-- NULL means "always suppress regardless of changes" (used for series classifications).
ALTER TABLE public.calendar_event_classifications
  ADD COLUMN IF NOT EXISTS suppressed_fingerprint text;
