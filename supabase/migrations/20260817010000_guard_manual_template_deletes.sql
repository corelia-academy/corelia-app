-- Prevent direct API deletes of automatic activity-milestone templates.
-- The client guard is only a UX safeguard; this restrictive policy is the
-- database invariant that protects the auto-template audit trail.
DROP POLICY IF EXISTS credential_templates_manual_activity_delete_guard
  ON public.credential_templates;

CREATE POLICY credential_templates_manual_activity_delete_guard
  ON public.credential_templates
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    scope_type <> 'activity_milestone'
    OR trigger_type = 'manual'
  );
