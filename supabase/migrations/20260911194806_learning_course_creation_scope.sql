-- AUD-15: draft creation must authorize the creator and support INSERT RETURNING.
-- A STABLE helper that re-reads courses cannot see a newly inserted row in the
-- statement snapshot. Use the candidate row for owner/staff SELECT authorization.
ALTER POLICY courses_insert_manager ON public.courses WITH CHECK (
  public.is_admin_or_support()
  OR (
    instructor_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'instructor')
  )
);
CREATE POLICY learning_course_owner_read ON public.courses FOR SELECT TO authenticated
USING (instructor_id = (SELECT auth.uid()) OR public.is_admin_or_support());
