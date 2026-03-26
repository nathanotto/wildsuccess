-- =============================================================================
-- Wild Success: Plan Module
-- Migration 026: Missions, Factors, COAs, Links, Participants
-- =============================================================================

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Missions (create first, add parent_coa_id FK after coas table exists)
CREATE TABLE missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  parent_coa_id uuid, -- FK added after coas table
  big_outcome_id uuid UNIQUE REFERENCES big_outcomes ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'completed', 'abandoned')),
  is_public boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Factors
CREATE TABLE factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('success', 'driver', 'constraint', 'fact', 'assumption')),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_factors_mission_kind_sort ON factors (mission_id, kind, sort_order);

-- Courses of Action
CREATE TABLE coas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'committed', 'in_progress', 'completed', 'abandoned')),
  big_outcome_id uuid REFERENCES big_outcomes ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Now add the deferred FK from missions.parent_coa_id → coas
ALTER TABLE missions
  ADD CONSTRAINT missions_parent_coa_id_fkey
  FOREIGN KEY (parent_coa_id) REFERENCES coas (id) ON DELETE SET NULL;

-- COA-Factor Links
CREATE TABLE coa_factor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_id uuid NOT NULL REFERENCES coas ON DELETE CASCADE,
  factor_id uuid NOT NULL REFERENCES factors ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coa_id, factor_id)
);

-- Mission Participants
CREATE TABLE mission_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'creator'
    CHECK (role IN ('creator', 'collaborator', 'observer')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (mission_id, user_id)
);

-- Mission Value Links
CREATE TABLE mission_value_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  value_id uuid NOT NULL REFERENCES user_values ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('strong', 'moderate', 'weak')),
  UNIQUE (mission_id, value_id, user_id)
);

-- Add coa_id to action_items for Plan-to-Hopper bridge
ALTER TABLE action_items ADD COLUMN coa_id uuid REFERENCES coas ON DELETE SET NULL;

-- =============================================================================
-- 2. TRIGGERS (updated_at)
-- =============================================================================

CREATE TRIGGER set_missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_coas_updated_at
  BEFORE UPDATE ON coas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE coas ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_factor_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_value_links ENABLE ROW LEVEL SECURITY;

-- Missions: owner CRUD
CREATE POLICY missions_select ON missions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY missions_insert ON missions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY missions_update ON missions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY missions_delete ON missions FOR DELETE USING (user_id = auth.uid());

-- Factors: owner CRUD + select on missions user owns
CREATE POLICY factors_select ON factors FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);
CREATE POLICY factors_insert ON factors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY factors_update ON factors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY factors_delete ON factors FOR DELETE USING (user_id = auth.uid());

-- COAs: same pattern as factors
CREATE POLICY coas_select ON coas FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);
CREATE POLICY coas_insert ON coas FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY coas_update ON coas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY coas_delete ON coas FOR DELETE USING (user_id = auth.uid());

-- COA-Factor Links: via coa ownership
CREATE POLICY coa_factor_links_select ON coa_factor_links FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_factor_links_insert ON coa_factor_links FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_factor_links_delete ON coa_factor_links FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);

-- Mission Participants: see own rows + missions you own
CREATE POLICY mission_participants_select ON mission_participants FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);
CREATE POLICY mission_participants_insert ON mission_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);

-- Mission Value Links: owner CRUD
CREATE POLICY mission_value_links_select ON mission_value_links FOR SELECT USING (user_id = auth.uid());
CREATE POLICY mission_value_links_insert ON mission_value_links FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY mission_value_links_update ON mission_value_links FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY mission_value_links_delete ON mission_value_links FOR DELETE USING (user_id = auth.uid());
