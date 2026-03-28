-- Supabase Realtime filters require REPLICA IDENTITY FULL to filter by non-PK columns
-- Without this, filtered subscriptions (e.g., mission_id=eq.xxx) won't receive events

ALTER TABLE factors REPLICA IDENTITY FULL;
ALTER TABLE coas REPLICA IDENTITY FULL;
ALTER TABLE coa_factor_links REPLICA IDENTITY FULL;
