-- ─── Migration 016: Today Page ───────────────────────────────────────────────
-- Adds: in_progress + parked status, expanded action_log events,
--       item_notes table, parked_until column

-- ─── 1. schedule_items status ────────────────────────────────────────────────

ALTER TABLE public.schedule_items DROP CONSTRAINT IF EXISTS schedule_items_status_check;
ALTER TABLE public.schedule_items ADD CONSTRAINT schedule_items_status_check
  CHECK (status IN ('active', 'in_progress', 'completed', 'skipped', 'rescheduled', 'parked'));

-- ─── 2. parked_until column ──────────────────────────────────────────────────

ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS parked_until date;

-- ─── 3. action_log event types ───────────────────────────────────────────────

ALTER TABLE public.action_log DROP CONSTRAINT IF EXISTS action_log_event_type_check;
ALTER TABLE public.action_log ADD CONSTRAINT action_log_event_type_check
  CHECK (event_type IN (
    'proposed', 'scheduled', 'committed', 'rescheduled', 'removed',
    'completed', 'skipped', 'captured', 'dismissed',
    'reopened', 'parked', 'in_progress'
  ));

-- ─── 4. item_notes table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.item_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_item_id   uuid NOT NULL REFERENCES public.schedule_items(id) ON DELETE CASCADE,
  note_type          text NOT NULL CHECK (note_type IN ('note', 'step')),
  content            text NOT NULL,
  is_completed       boolean NOT NULL DEFAULT false,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_notes_select_own"  ON public.item_notes FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "item_notes_insert_own"  ON public.item_notes FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "item_notes_update_own"  ON public.item_notes FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "item_notes_delete_own"  ON public.item_notes FOR DELETE  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS item_notes_user_id_idx          ON public.item_notes(user_id);
CREATE INDEX IF NOT EXISTS item_notes_schedule_item_id_idx ON public.item_notes(schedule_item_id);
CREATE INDEX IF NOT EXISTS item_notes_note_type_idx        ON public.item_notes(note_type);

CREATE TRIGGER set_item_notes_updated_at
  BEFORE UPDATE ON public.item_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
