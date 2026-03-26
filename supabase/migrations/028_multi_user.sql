-- =============================================================================
-- Wild Success: Multi-User Collaboration, Commitments, Invitations
-- Migration 028
-- =============================================================================

-- =============================================================================
-- 1. User profiles: app_role + communication preferences
-- =============================================================================

ALTER TABLE user_profiles ADD COLUMN app_role text NOT NULL DEFAULT 'mission_collaborator'
  CHECK (app_role IN ('admin', 'full', 'mission_collaborator'));

ALTER TABLE user_profiles ADD COLUMN communication_preferences jsonb NOT NULL DEFAULT '{
  "digest_enabled": true,
  "digest_frequency": "weekly",
  "invitation_emails": true,
  "commitment_reminders": true
}'::jsonb;

-- Set Nathan as admin
UPDATE user_profiles SET app_role = 'admin' WHERE id = '6a066109-a638-44ff-a811-cccd16cb0935';

-- Update new-user trigger to NOT seed map data for mission_collaborators
-- (they don't need values, domains, activities)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, preferred_name, app_role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'preferred_name',
    'mission_collaborator'
  );
  -- Only seed map data for full users (collaborators don't need it)
  -- Map data can be seeded later when they upgrade to 'full'
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 2. Access requests
-- =============================================================================

CREATE TABLE access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  note text,
  resolved_by uuid REFERENCES auth.users,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_requests_select_own ON access_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY access_requests_insert_own ON access_requests FOR INSERT WITH CHECK (user_id = auth.uid());
-- Admin policies handled in app layer (service role) since we can't easily reference app_role in RLS

-- =============================================================================
-- 3. Commitments
-- =============================================================================

CREATE TABLE commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_id uuid NOT NULL REFERENCES coas ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  description text,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  completed_at timestamptz,
  completion_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coa_id, user_id)
);

CREATE TRIGGER set_commitments_updated_at
  BEFORE UPDATE ON commitments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

-- Commitments visible to mission participants
CREATE POLICY commitments_select ON commitments FOR SELECT USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY commitments_insert ON commitments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY commitments_update ON commitments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY commitments_delete ON commitments FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- 4. Mission invitations
-- =============================================================================

CREATE TABLE mission_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('collaborator', 'observer')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (mission_id, email)
);

CREATE UNIQUE INDEX idx_mission_invitations_token ON mission_invitations (token);

ALTER TABLE mission_invitations ENABLE ROW LEVEL SECURITY;

-- Participants can see/create invitations for their missions
CREATE POLICY mission_invitations_select ON mission_invitations FOR SELECT USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY mission_invitations_insert ON mission_invitations FOR INSERT WITH CHECK (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY mission_invitations_delete ON mission_invitations FOR DELETE USING (
  invited_by = auth.uid()
);
-- Public select by token (for accept flow) — handled via service role in API

-- =============================================================================
-- 5. Action items: add mission_id and assigned_to
-- =============================================================================

-- coa_id was already added in migration 026
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES missions ON DELETE SET NULL;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users ON DELETE SET NULL;

-- =============================================================================
-- 6. RLS policy updates for multi-user Plan tables
-- =============================================================================

-- Helper: is user a participant in mission?
-- We use subqueries in policies since Postgres doesn't support functions in RLS easily

-- Missions: participants can see, only creator can update/delete
DROP POLICY IF EXISTS missions_select ON missions;
DROP POLICY IF EXISTS missions_update ON missions;
DROP POLICY IF EXISTS missions_delete ON missions;

CREATE POLICY missions_select ON missions FOR SELECT USING (
  user_id = auth.uid()
  OR id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY missions_update ON missions FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY missions_delete ON missions FOR DELETE USING (
  user_id = auth.uid()
);

-- Factors: participants can CRUD
DROP POLICY IF EXISTS factors_select ON factors;
DROP POLICY IF EXISTS factors_insert ON factors;
DROP POLICY IF EXISTS factors_update ON factors;
DROP POLICY IF EXISTS factors_delete ON factors;

CREATE POLICY factors_select ON factors FOR SELECT USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY factors_insert ON factors FOR INSERT WITH CHECK (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY factors_update ON factors FOR UPDATE USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY factors_delete ON factors FOR DELETE USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);

-- COAs: participants can CRUD
DROP POLICY IF EXISTS coas_select ON coas;
DROP POLICY IF EXISTS coas_insert ON coas;
DROP POLICY IF EXISTS coas_update ON coas;
DROP POLICY IF EXISTS coas_delete ON coas;

CREATE POLICY coas_select ON coas FOR SELECT USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY coas_insert ON coas FOR INSERT WITH CHECK (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY coas_update ON coas FOR UPDATE USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY coas_delete ON coas FOR DELETE USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);

-- COA factor links: via COA's mission participants
DROP POLICY IF EXISTS coa_factor_links_select ON coa_factor_links;
DROP POLICY IF EXISTS coa_factor_links_insert ON coa_factor_links;
DROP POLICY IF EXISTS coa_factor_links_delete ON coa_factor_links;

CREATE POLICY coa_factor_links_select ON coa_factor_links FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_factor_links_insert ON coa_factor_links FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_factor_links_delete ON coa_factor_links FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);

-- COA dependencies: via COA's mission participants
DROP POLICY IF EXISTS coa_dependencies_select ON coa_dependencies;
DROP POLICY IF EXISTS coa_dependencies_insert ON coa_dependencies;
DROP POLICY IF EXISTS coa_dependencies_update ON coa_dependencies;
DROP POLICY IF EXISTS coa_dependencies_delete ON coa_dependencies;

CREATE POLICY coa_dependencies_select ON coa_dependencies FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_dependencies_insert ON coa_dependencies FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_dependencies_update ON coa_dependencies FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_dependencies_delete ON coa_dependencies FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);

-- COA resource needs: via COA's mission participants
DROP POLICY IF EXISTS coa_resource_needs_select ON coa_resource_needs;
DROP POLICY IF EXISTS coa_resource_needs_insert ON coa_resource_needs;
DROP POLICY IF EXISTS coa_resource_needs_update ON coa_resource_needs;
DROP POLICY IF EXISTS coa_resource_needs_delete ON coa_resource_needs;

CREATE POLICY coa_resource_needs_select ON coa_resource_needs FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_resource_needs_insert ON coa_resource_needs FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_resource_needs_update ON coa_resource_needs FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);
CREATE POLICY coa_resource_needs_delete ON coa_resource_needs FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()))
);

-- Mission log: participants can see and insert, no update/delete
DROP POLICY IF EXISTS mission_log_select ON mission_log;
DROP POLICY IF EXISTS mission_log_insert ON mission_log;

CREATE POLICY mission_log_select ON mission_log FOR SELECT USING (
  mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);
CREATE POLICY mission_log_insert ON mission_log FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);

-- Mission participants: participants can see their missions' participants
DROP POLICY IF EXISTS mission_participants_select ON mission_participants;
DROP POLICY IF EXISTS mission_participants_insert ON mission_participants;

CREATE POLICY mission_participants_select ON mission_participants FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT mission_id FROM mission_participants mp WHERE mp.user_id = auth.uid())
);
CREATE POLICY mission_participants_insert ON mission_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);

-- Mission value links: participants can see
DROP POLICY IF EXISTS mission_value_links_select ON mission_value_links;

CREATE POLICY mission_value_links_select ON mission_value_links FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);

-- Action items: add policy for COA-sourced items visible to mission participants
-- Keep existing personal item policies, add shared mission item visibility
CREATE POLICY action_items_select_shared ON action_items FOR SELECT USING (
  mission_id IS NOT NULL
  AND mission_id IN (SELECT mission_id FROM mission_participants WHERE user_id = auth.uid())
);

-- User profiles: admin can see all (for admin panel)
CREATE POLICY user_profiles_admin_select ON user_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.app_role = 'admin')
);
