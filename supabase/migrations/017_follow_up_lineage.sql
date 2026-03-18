-- Track follow-up lineage: every item that spawns from completing another
-- can point back to its origin, enabling full chain reconstruction for reporting.

ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS source_schedule_item_id uuid REFERENCES schedule_items(id) ON DELETE SET NULL;

ALTER TABLE hopper_items
  ADD COLUMN IF NOT EXISTS source_schedule_item_id uuid REFERENCES schedule_items(id) ON DELETE SET NULL;

-- Index for "find all follow-ups from item X"
CREATE INDEX IF NOT EXISTS idx_schedule_items_source ON schedule_items(source_schedule_item_id) WHERE source_schedule_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hopper_items_source ON hopper_items(source_schedule_item_id) WHERE source_schedule_item_id IS NOT NULL;
