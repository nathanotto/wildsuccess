-- Fix infinite recursion in user_profiles RLS policy
-- The admin_select policy referenced user_profiles from within user_profiles, causing recursion

DROP POLICY IF EXISTS user_profiles_admin_select ON user_profiles;

-- Instead, use auth.jwt() to check the role without querying user_profiles
-- Since app_role is in user_profiles (not JWT), we use a security definer function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND app_role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin can see all profiles using the security definer function (avoids recursion)
CREATE POLICY user_profiles_admin_select ON user_profiles FOR SELECT USING (
  is_admin()
);
