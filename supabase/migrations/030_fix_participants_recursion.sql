-- Fix infinite recursion in mission_participants RLS
-- The policy referenced mission_participants from within mission_participants

-- Create a security definer function to get user's mission IDs without triggering RLS
CREATE OR REPLACE FUNCTION user_mission_ids()
RETURNS SETOF uuid AS $$
  SELECT mission_id FROM mission_participants WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fix mission_participants: simple own-row check, no self-reference
DROP POLICY IF EXISTS mission_participants_select ON mission_participants;
CREATE POLICY mission_participants_select ON mission_participants FOR SELECT USING (
  user_id = auth.uid()
  OR mission_id IN (SELECT user_mission_ids())
);

-- Fix missions: use the function instead of subquery on mission_participants
DROP POLICY IF EXISTS missions_select ON missions;
CREATE POLICY missions_select ON missions FOR SELECT USING (
  user_id = auth.uid()
  OR id IN (SELECT user_mission_ids())
);

-- Fix all other tables that reference mission_participants in their policies
DROP POLICY IF EXISTS factors_select ON factors;
CREATE POLICY factors_select ON factors FOR SELECT USING (
  user_id = auth.uid() OR mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS factors_insert ON factors;
CREATE POLICY factors_insert ON factors FOR INSERT WITH CHECK (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS factors_update ON factors;
CREATE POLICY factors_update ON factors FOR UPDATE USING (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS factors_delete ON factors;
CREATE POLICY factors_delete ON factors FOR DELETE USING (
  mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS coas_select ON coas;
CREATE POLICY coas_select ON coas FOR SELECT USING (
  user_id = auth.uid() OR mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS coas_insert ON coas;
CREATE POLICY coas_insert ON coas FOR INSERT WITH CHECK (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS coas_update ON coas;
CREATE POLICY coas_update ON coas FOR UPDATE USING (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS coas_delete ON coas;
CREATE POLICY coas_delete ON coas FOR DELETE USING (
  mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS coa_factor_links_select ON coa_factor_links;
CREATE POLICY coa_factor_links_select ON coa_factor_links FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_factor_links_insert ON coa_factor_links;
CREATE POLICY coa_factor_links_insert ON coa_factor_links FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_factor_links_delete ON coa_factor_links;
CREATE POLICY coa_factor_links_delete ON coa_factor_links FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);

DROP POLICY IF EXISTS coa_dependencies_select ON coa_dependencies;
CREATE POLICY coa_dependencies_select ON coa_dependencies FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_dependencies_insert ON coa_dependencies;
CREATE POLICY coa_dependencies_insert ON coa_dependencies FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_dependencies_update ON coa_dependencies;
CREATE POLICY coa_dependencies_update ON coa_dependencies FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_dependencies_delete ON coa_dependencies;
CREATE POLICY coa_dependencies_delete ON coa_dependencies FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);

DROP POLICY IF EXISTS coa_resource_needs_select ON coa_resource_needs;
CREATE POLICY coa_resource_needs_select ON coa_resource_needs FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_resource_needs_insert ON coa_resource_needs;
CREATE POLICY coa_resource_needs_insert ON coa_resource_needs FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_resource_needs_update ON coa_resource_needs;
CREATE POLICY coa_resource_needs_update ON coa_resource_needs FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);
DROP POLICY IF EXISTS coa_resource_needs_delete ON coa_resource_needs;
CREATE POLICY coa_resource_needs_delete ON coa_resource_needs FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE mission_id IN (SELECT user_mission_ids()))
);

DROP POLICY IF EXISTS mission_log_select ON mission_log;
CREATE POLICY mission_log_select ON mission_log FOR SELECT USING (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS mission_log_insert ON mission_log;
CREATE POLICY mission_log_insert ON mission_log FOR INSERT WITH CHECK (
  user_id = auth.uid() AND mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS mission_value_links_select ON mission_value_links;
CREATE POLICY mission_value_links_select ON mission_value_links FOR SELECT USING (
  user_id = auth.uid() OR mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS commitments_select ON commitments;
CREATE POLICY commitments_select ON commitments FOR SELECT USING (
  mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS mission_invitations_select ON mission_invitations;
CREATE POLICY mission_invitations_select ON mission_invitations FOR SELECT USING (
  mission_id IN (SELECT user_mission_ids())
);
DROP POLICY IF EXISTS mission_invitations_insert ON mission_invitations;
CREATE POLICY mission_invitations_insert ON mission_invitations FOR INSERT WITH CHECK (
  mission_id IN (SELECT user_mission_ids())
);

DROP POLICY IF EXISTS mission_participants_insert ON mission_participants;
CREATE POLICY mission_participants_insert ON mission_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS action_items_select_shared ON action_items;
CREATE POLICY action_items_select_shared ON action_items FOR SELECT USING (
  mission_id IS NOT NULL AND mission_id IN (SELECT user_mission_ids())
);
