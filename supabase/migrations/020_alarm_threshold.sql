-- Per-activity alarm threshold: how many days without completion before
-- the Values Map dot turns red. Defaults to 8. Users can set lower
-- (e.g. 3 for exercise) or higher per activity.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS alarm_threshold_days integer NOT NULL DEFAULT 8;
