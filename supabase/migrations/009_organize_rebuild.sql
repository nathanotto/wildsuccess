-- 009_organize_rebuild.sql
-- Session 6: Block types, focus settings, hopper priority fields

-- ─── block_types ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.block_types (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  color                    text NOT NULL,
  default_duration_minutes integer NOT NULL DEFAULT 60,
  energy_level             text NOT NULL DEFAULT 'B' CHECK (energy_level IN ('A', 'B', 'C')),
  icon                     text,
  sort_order               integer NOT NULL DEFAULT 0,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.block_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block_types_select_own" ON public.block_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "block_types_insert_own" ON public.block_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "block_types_update_own" ON public.block_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "block_types_delete_own" ON public.block_types FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_block_types_updated_at
  BEFORE UPDATE ON public.block_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS block_types_user_id_idx ON public.block_types(user_id);

-- ─── focus_settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.focus_settings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_focus_minutes  integer NOT NULL DEFAULT 50 CHECK (default_focus_minutes IN (25, 50, 75)),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "focus_settings_select_own" ON public.focus_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "focus_settings_insert_own" ON public.focus_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_settings_update_own" ON public.focus_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "focus_settings_delete_own" ON public.focus_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_focus_settings_updated_at
  BEFORE UPDATE ON public.focus_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Alter time_blocks ────────────────────────────────────────────────────────

ALTER TABLE public.time_blocks
  ADD COLUMN IF NOT EXISTS block_type_id        uuid REFERENCES public.block_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_minutes      integer,
  ADD COLUMN IF NOT EXISTS focus_override_minutes integer CHECK (focus_override_minutes IN (25, 50, 75));

CREATE INDEX IF NOT EXISTS time_blocks_block_type_id_idx ON public.time_blocks(block_type_id);

-- ─── Alter hopper_items ───────────────────────────────────────────────────────

ALTER TABLE public.hopper_items
  ADD COLUMN IF NOT EXISTS priority_score  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_tier   text DEFAULT 'normal' CHECK (priority_tier IN ('urgent', 'normal', 'suggested')),
  ADD COLUMN IF NOT EXISTS block_type_hint uuid REFERENCES public.block_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hopper_items_priority_score_idx ON public.hopper_items(priority_score);
CREATE INDEX IF NOT EXISTS hopper_items_priority_tier_idx  ON public.hopper_items(priority_tier);
CREATE INDEX IF NOT EXISTS hopper_items_block_type_hint_idx ON public.hopper_items(block_type_hint);

-- ─── seed_default_block_types ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_default_block_types(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.block_types (user_id, name, color, default_duration_minutes, energy_level, icon, sort_order)
  VALUES
    (p_user_id, 'Focus',                '#C4725A', 50,  'A', '🎯', 0),
    (p_user_id, 'Communicate',          '#4B82AF', 30,  'B', '💬', 1),
    (p_user_id, 'Social/Family',        '#7A6BAF', 60,  'B', '👥', 2),
    (p_user_id, 'Meeting/Appointment',  '#9E6A46', 60,  'B', '📅', 3),
    (p_user_id, 'Outing',               '#7A9E82', 120, 'C', '🚶', 4),
    (p_user_id, 'Admin',                '#8A857D', 45,  'B', '📋', 5),
    (p_user_id, 'Recharge',             '#5A9E6F', 30,  'C', '🔋', 6),
    (p_user_id, 'Ritual',               '#B8443E', 30,  'B', '🕯️', 7),
    (p_user_id, 'Planning',             '#C4725A', 45,  'A', '🗺️', 8),
    (p_user_id, 'Self-Care',            '#5A9E6F', 45,  'C', '🌿', 9)
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.focus_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── Update handle_new_user trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id) VALUES (new.id);
  PERFORM seed_default_map_data(new.id);
  PERFORM seed_default_block_types(new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
