-- Weekly/daily heat snapshots for retrospective animation
CREATE TABLE IF NOT EXISTS value_heat_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value_id uuid NOT NULL,
  heat numeric NOT NULL,
  score integer NOT NULL,
  snapshot_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, value_id, snapshot_date)
);

ALTER TABLE value_heat_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots"
  ON value_heat_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON value_heat_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_heat_snapshots_user_date ON value_heat_snapshots(user_id, snapshot_date);
