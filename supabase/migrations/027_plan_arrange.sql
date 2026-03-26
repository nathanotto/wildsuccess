-- =============================================================================
-- Wild Success: Plan Module — Arrange, COA Structure, Factor Lifecycle, Mission Log
-- Migration 027
-- =============================================================================

-- =============================================================================
-- 1. COA structure: split name into action + outcome
-- =============================================================================

ALTER TABLE coas RENAME COLUMN name TO action;
ALTER TABLE coas ADD COLUMN outcome text;

-- =============================================================================
-- 2. COA time horizon
-- =============================================================================

ALTER TABLE coas ADD COLUMN time_horizon text NOT NULL DEFAULT 'unset'
  CHECK (time_horizon IN ('unset', 'now', 'next', 'later'));

-- =============================================================================
-- 3. Factor-COA link relationship type
-- =============================================================================

ALTER TABLE coa_factor_links ADD COLUMN relationship text NOT NULL DEFAULT 'accounts_for'
  CHECK (relationship IN ('accounts_for', 'aims_to_resolve'));

-- =============================================================================
-- 4. Factor lifecycle
-- =============================================================================

ALTER TABLE factors ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'resolved'));
ALTER TABLE factors ADD COLUMN resolution_note text;
ALTER TABLE factors ADD COLUMN resolved_at timestamptz;
ALTER TABLE factors ADD COLUMN resolved_by_coa_id uuid REFERENCES coas(id) ON DELETE SET NULL;

-- =============================================================================
-- 5. COA dependencies
-- =============================================================================

CREATE TABLE coa_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_id uuid NOT NULL REFERENCES coas(id) ON DELETE CASCADE,
  depends_on_coa_id uuid NOT NULL REFERENCES coas(id) ON DELETE CASCADE,
  reason text NOT NULL,
  is_hard boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coa_id, depends_on_coa_id),
  CHECK (coa_id != depends_on_coa_id)
);

-- =============================================================================
-- 6. COA resource needs
-- =============================================================================

CREATE TABLE coa_resource_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coa_id uuid NOT NULL REFERENCES coas(id) ON DELETE CASCADE,
  description text NOT NULL,
  kind text NOT NULL DEFAULT 'other'
    CHECK (kind IN ('time', 'money', 'people', 'materials', 'access', 'other')),
  quantity numeric,
  unit text,
  status text NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'partially_met', 'met')),
  status_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_coa_resource_needs_updated_at
  BEFORE UPDATE ON coa_resource_needs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 7. Mission log
-- =============================================================================

CREATE TABLE mission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  entry_type text NOT NULL
    CHECK (entry_type IN (
      'factor_added', 'factor_resolved', 'factor_invalidated',
      'coa_created', 'coa_completed', 'coa_abandoned', 'coa_committed',
      'dependency_added', 'dependency_removed',
      'resource_added', 'resource_met',
      'commitment_made', 'mission_status_changed', 'note'
    )),
  subject_type text,
  subject_id uuid,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mission_log_mission_created ON mission_log (mission_id, created_at DESC);

-- =============================================================================
-- 8. RLS Policies
-- =============================================================================

ALTER TABLE coa_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_resource_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_log ENABLE ROW LEVEL SECURITY;

-- coa_dependencies: via coa ownership
CREATE POLICY coa_dependencies_select ON coa_dependencies FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_dependencies_insert ON coa_dependencies FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_dependencies_update ON coa_dependencies FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_dependencies_delete ON coa_dependencies FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);

-- coa_resource_needs: via coa ownership
CREATE POLICY coa_resource_needs_select ON coa_resource_needs FOR SELECT USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_resource_needs_insert ON coa_resource_needs FOR INSERT WITH CHECK (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_resource_needs_update ON coa_resource_needs FOR UPDATE USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);
CREATE POLICY coa_resource_needs_delete ON coa_resource_needs FOR DELETE USING (
  coa_id IN (SELECT id FROM coas WHERE user_id = auth.uid())
);

-- mission_log: select on owned missions, insert for own user on owned missions, no update/delete
CREATE POLICY mission_log_select ON mission_log FOR SELECT USING (
  mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);
CREATE POLICY mission_log_insert ON mission_log FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND mission_id IN (SELECT id FROM missions WHERE user_id = auth.uid())
);
