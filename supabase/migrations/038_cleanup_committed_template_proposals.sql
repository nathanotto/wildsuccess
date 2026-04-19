-- Clean up template_proposal action_items that were committed but never completed.
-- These are system-generated scheduling scaffolding (e.g. 7x "Wind-down routine" per week).
-- Items that were actually completed are kept — they represent real user activity.
DELETE FROM action_items
WHERE source = 'template_proposal'
  AND status NOT IN ('completed', 'in_progress');
