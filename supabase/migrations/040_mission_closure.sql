-- Add closure fields to missions
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS closure_type text CHECK (closure_type IS NULL OR closure_type = ANY (ARRAY[
    'accomplished'::text,
    'partially_accomplished'::text,
    'shelved'::text,
    'superseded'::text,
    'abandoned'::text
  ])),
  ADD COLUMN IF NOT EXISTS closure_note text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update status constraint to include new statuses
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE missions ADD CONSTRAINT missions_status_check
  CHECK (status IN ('planning', 'active', 'completed', 'abandoned', 'shelved', 'superseded'));
