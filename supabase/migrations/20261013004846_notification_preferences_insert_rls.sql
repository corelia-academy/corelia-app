-- New accounts may not have a preference row yet. The browser saves the first
-- change with an upsert, which needs both INSERT and UPDATE RLS policies.
CREATE POLICY np_insert_own
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
