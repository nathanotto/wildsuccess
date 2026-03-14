-- 008_week_and_calendar.sql
-- Session 5: Week view, Google Calendar integration, Time Template

-- ─── calendar_connections ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         text NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  access_token     text NOT NULL,
  refresh_token    text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  calendar_ids     text[] NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  last_synced_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_connections_select_own" ON public.calendar_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calendar_connections_insert_own" ON public.calendar_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "calendar_connections_update_own" ON public.calendar_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "calendar_connections_delete_own" ON public.calendar_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── calendar_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_event_id  text NOT NULL,
  external_series_id text,
  calendar_id        text NOT NULL,
  title              text NOT NULL,
  description        text,
  start_time         timestamptz NOT NULL,
  end_time           timestamptz NOT NULL,
  location           text,
  attendees          jsonb,
  is_all_day         boolean NOT NULL DEFAULT false,
  recurrence_rule    text,
  raw_event          jsonb,
  last_synced_at     timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_event_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events_select_own" ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calendar_events_insert_own" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "calendar_events_update_own" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "calendar_events_delete_own" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── calendar_event_classifications ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_event_classifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_key      text NOT NULL,
  match_type     text NOT NULL CHECK (match_type IN ('series', 'event')),
  classification text NOT NULL CHECK (classification IN ('provisional', 'info', 'fixed_commitment', 'flexible_commitment')),
  display_label  text,
  energy_level   text CHECK (energy_level IN ('A', 'B', 'C')),
  life_domain_id uuid REFERENCES public.life_domains(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_key)
);

ALTER TABLE public.calendar_event_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cal_class_select_own" ON public.calendar_event_classifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cal_class_insert_own" ON public.calendar_event_classifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cal_class_update_own" ON public.calendar_event_classifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cal_class_delete_own" ON public.calendar_event_classifications FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_cal_class_updated_at
  BEFORE UPDATE ON public.calendar_event_classifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── time_template_blocks ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_template_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
  label        text NOT NULL,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  context      text[] DEFAULT '{}',
  energy_level text NOT NULL DEFAULT 'B' CHECK (energy_level IN ('A', 'B', 'C')),
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_template_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_template_select_own" ON public.time_template_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_template_insert_own" ON public.time_template_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_template_update_own" ON public.time_template_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_template_delete_own" ON public.time_template_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_time_template_updated_at
  BEFORE UPDATE ON public.time_template_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS calendar_connections_user_id_idx    ON public.calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx         ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS calendar_events_external_event_idx  ON public.calendar_events(external_event_id);
CREATE INDEX IF NOT EXISTS calendar_events_series_id_idx       ON public.calendar_events(external_series_id);
CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx      ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS calendar_events_calendar_id_idx     ON public.calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS cal_class_user_id_idx               ON public.calendar_event_classifications(user_id);
CREATE INDEX IF NOT EXISTS cal_class_match_key_idx             ON public.calendar_event_classifications(match_key);
CREATE INDEX IF NOT EXISTS time_template_user_id_idx           ON public.time_template_blocks(user_id);
CREATE INDEX IF NOT EXISTS time_template_day_of_week_idx       ON public.time_template_blocks(day_of_week);
