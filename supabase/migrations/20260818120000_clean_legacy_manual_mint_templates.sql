-- Migration: Clean and deactivate legacy manual-mint test templates
-- Ensures only templates explicitly created with "saved_as_template = true" appear in the badge templates library.

UPDATE public.credential_templates
SET is_active = false
WHERE scope_type = 'activity_milestone'
  AND trigger_type = 'manual'
  AND (
    trigger_rule IS NULL
    OR NOT (trigger_rule ? 'saved_as_template')
    OR (trigger_rule->>'saved_as_template')::boolean IS NOT TRUE
  );
