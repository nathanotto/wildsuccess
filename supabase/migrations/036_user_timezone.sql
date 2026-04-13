-- Add timezone preference to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Denver';
