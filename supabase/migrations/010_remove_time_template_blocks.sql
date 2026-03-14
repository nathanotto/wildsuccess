-- 010_remove_time_template_blocks.sql
-- Remove time_template-sourced rows from time_blocks (legacy Session 5 artifacts)
-- The time_template system has been replaced by manual block placement in Session 6.

DELETE FROM public.time_blocks WHERE source = 'time_template';
