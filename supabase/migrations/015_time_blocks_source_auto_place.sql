-- Add 'auto_place' as a valid source value for time_blocks
ALTER TABLE public.time_blocks
  DROP CONSTRAINT IF EXISTS time_blocks_source_check;

ALTER TABLE public.time_blocks
  ADD CONSTRAINT time_blocks_source_check
    CHECK (source IN ('manual', 'time_template', 'calendar_import', 'auto_place'));
