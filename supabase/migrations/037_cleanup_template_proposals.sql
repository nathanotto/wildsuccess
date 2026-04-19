-- Clean up historical template_proposal action_items that were never committed.
-- These were created by the old propose endpoint but are now computed virtually.
-- Only delete candidates — committed/completed template_proposals represent real user actions.
DELETE FROM action_items
WHERE source = 'template_proposal'
  AND status IN ('candidate', 'dismissed')
  AND committed_date IS NULL;
