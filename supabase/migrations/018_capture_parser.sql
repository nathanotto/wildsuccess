-- Migration 018: Capture parser — known_people, value links, logged event type

-- Add 'logged' event type to action_log
ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_event_type_check;
ALTER TABLE action_log ADD CONSTRAINT action_log_event_type_check
  CHECK (event_type IN (
    'proposed', 'scheduled', 'committed', 'rescheduled', 'removed',
    'completed', 'skipped', 'captured', 'dismissed', 'reopened',
    'parked', 'in_progress', 'logged'
  ));

-- Known people: people the user mentions in captures
CREATE TABLE IF NOT EXISTS known_people (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  normalized_name   text NOT NULL,
  notes             text,
  mention_count     integer NOT NULL DEFAULT 0,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_mentioned_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT known_people_pkey PRIMARY KEY (id),
  CONSTRAINT known_people_unique_name UNIQUE (user_id, normalized_name)
);

ALTER TABLE known_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "known_people_select_own" ON known_people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "known_people_insert_own" ON known_people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "known_people_update_own" ON known_people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "known_people_delete_own" ON known_people FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_known_people_user_id ON known_people(user_id);
CREATE INDEX IF NOT EXISTS idx_known_people_normalized_name ON known_people(normalized_name);

CREATE OR REPLACE TRIGGER known_people_updated_at
  BEFORE UPDATE ON known_people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Value links between known_people and user_values
CREATE TABLE IF NOT EXISTS known_people_value_links (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id             uuid NOT NULL REFERENCES known_people(id) ON DELETE CASCADE,
  value_id              uuid NOT NULL REFERENCES user_values(id) ON DELETE CASCADE,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT known_people_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT known_people_value_links_unique UNIQUE (person_id, value_id)
);

ALTER TABLE known_people_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpvl_select_own" ON known_people_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kpvl_insert_own" ON known_people_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kpvl_update_own" ON known_people_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kpvl_delete_own" ON known_people_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kpvl_person_id ON known_people_value_links(person_id);
