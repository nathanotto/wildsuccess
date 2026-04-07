-- Rolling to-do list: items roll forward automatically until resolved
-- Add completed_date for clean date-based querying (avoids timezone issues with completed_at timestamptz)

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS completed_date date;

-- Backfill from existing completed_at values
UPDATE action_items
SET completed_date = (completed_at AT TIME ZONE 'America/Chicago')::date
WHERE completed_at IS NOT NULL AND completed_date IS NULL;

-- Indexes for rolling queries
CREATE INDEX IF NOT EXISTS idx_action_items_rolling ON action_items(user_id, committed_date, status);
CREATE INDEX IF NOT EXISTS idx_action_items_completed_date ON action_items(user_id, completed_date);
