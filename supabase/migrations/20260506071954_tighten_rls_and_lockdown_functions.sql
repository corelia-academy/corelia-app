-- Tighten overly-permissive RLS policies and remove SECURITY DEFINER RPC exposure.

-- -----------------------------------------------------------------------------
-- 1) Move SECURITY DEFINER helpers out of exposed schema (`public`)
--    Keep public wrappers (SECURITY INVOKER) so existing policies keep working.
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

-- Move definer functions to a non-exposed schema
ALTER FUNCTION public.current_profile_role() SET SCHEMA private;
ALTER FUNCTION public.is_admin_or_support() SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;

-- Recreate `public.*` wrappers (invoker) to preserve existing policy SQL.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.current_profile_role();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.is_admin_or_support();
$$;

-- Ensure API roles can execute the wrappers and the private definer functions they call.
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_or_support() TO anon, authenticated;

-- Update trigger to point at `private.handle_new_user()` (no public RPC surface).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2) Fix "RLS Policy Always True" on contest + offline tables
-- -----------------------------------------------------------------------------

-- Helper: contest visibility for the current user (mirrors `contests_select` policy)
-- Note: used only inside RLS expressions (no need for a function).

-- Contest registrations
DROP POLICY IF EXISTS contest_registrations_authenticated ON public.contest_registrations;
CREATE POLICY contest_registrations_select_own_or_staff
  ON public.contest_registrations FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  );

CREATE POLICY contest_registrations_insert_self
  ON public.contest_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND c.status IN ('published', 'running', 'ended')
    )
  );

CREATE POLICY contest_registrations_delete_self_or_staff
  ON public.contest_registrations FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  );

-- Contest access invites (staff / contest creator only)
DROP POLICY IF EXISTS contest_invites_authenticated ON public.contest_access_invites;
CREATE POLICY contest_invites_staff_or_creator
  ON public.contest_access_invites FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((select auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((select auth.uid())::text)
    )
  );

-- Contest submissions
DROP POLICY IF EXISTS contest_submissions_authenticated ON public.contest_submissions;
CREATE POLICY contest_submissions_select_own_or_staff
  ON public.contest_submissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  );

CREATE POLICY contest_submissions_insert_self
  ON public.contest_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND c.status IN ('published', 'running', 'ended')
    )
  );

CREATE POLICY contest_submissions_update_self_or_staff
  ON public.contest_submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  );

CREATE POLICY contest_submissions_delete_self_or_staff
  ON public.contest_submissions FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (select auth.uid())
  );

-- Contest scores: readable when contest is visible; writable by staff only
DROP POLICY IF EXISTS contest_scores_authenticated ON public.contest_scores;
CREATE POLICY contest_scores_select_visible
  ON public.contest_scores FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND c.status IN ('published', 'running', 'ended')
    )
  );

CREATE POLICY contest_scores_write_staff
  ON public.contest_scores FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY contest_scores_update_staff
  ON public.contest_scores FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY contest_scores_delete_staff
  ON public.contest_scores FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

-- Offline academy: keep SELECT open to authenticated, restrict writes.
-- (Lint flags ALL + true; SELECT-only `USING (true)` is intentionally allowed.)

-- offline_courses
DROP POLICY IF EXISTS offline_courses_auth_all ON public.offline_courses;
CREATE POLICY offline_courses_select_authenticated
  ON public.offline_courses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS offline_courses_write_staff_or_owner ON public.offline_courses;
CREATE POLICY offline_courses_insert_staff_or_owner
  ON public.offline_courses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_courses_update_staff_or_owner
  ON public.offline_courses FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_courses_delete_staff_or_owner
  ON public.offline_courses FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

-- offline_cohorts
DROP POLICY IF EXISTS offline_cohorts_auth_all ON public.offline_cohorts;
CREATE POLICY offline_cohorts_select_authenticated
  ON public.offline_cohorts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS offline_cohorts_write_staff_or_owner ON public.offline_cohorts;
CREATE POLICY offline_cohorts_insert_staff_or_owner
  ON public.offline_cohorts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

CREATE POLICY offline_cohorts_update_staff_or_owner
  ON public.offline_cohorts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

CREATE POLICY offline_cohorts_delete_staff_or_owner
  ON public.offline_cohorts FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

-- offline_sessions
DROP POLICY IF EXISTS offline_sessions_auth_all ON public.offline_sessions;
CREATE POLICY offline_sessions_select_authenticated
  ON public.offline_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS offline_sessions_write_staff_or_owner ON public.offline_sessions;
CREATE POLICY offline_sessions_insert_staff_or_owner
  ON public.offline_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

CREATE POLICY offline_sessions_update_staff_or_owner
  ON public.offline_sessions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

CREATE POLICY offline_sessions_delete_staff_or_owner
  ON public.offline_sessions FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'instructor_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
  );

-- offline_cohort_enrollments
DROP POLICY IF EXISTS offline_enrollments_auth_all ON public.offline_cohort_enrollments;
CREATE POLICY offline_enrollments_select_own_or_staff
  ON public.offline_cohort_enrollments FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS offline_enrollments_write_own_or_staff ON public.offline_cohort_enrollments;
CREATE POLICY offline_enrollments_insert_own_or_staff
  ON public.offline_cohort_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_enrollments_update_own_or_staff
  ON public.offline_cohort_enrollments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_enrollments_delete_own_or_staff
  ON public.offline_cohort_enrollments FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

-- offline_session_attendance
DROP POLICY IF EXISTS offline_attendance_auth_all ON public.offline_session_attendance;
CREATE POLICY offline_attendance_select_own_or_staff
  ON public.offline_session_attendance FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS offline_attendance_write_own_or_staff ON public.offline_session_attendance;
CREATE POLICY offline_attendance_insert_own_or_staff
  ON public.offline_session_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_attendance_update_own_or_staff
  ON public.offline_session_attendance FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_attendance_delete_own_or_staff
  ON public.offline_session_attendance FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

-- offline_assignment_submissions
DROP POLICY IF EXISTS offline_assignments_auth_all ON public.offline_assignment_submissions;
CREATE POLICY offline_assignments_select_own_or_staff
  ON public.offline_assignment_submissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS offline_assignments_write_own_or_staff ON public.offline_assignment_submissions;
CREATE POLICY offline_assignments_insert_own_or_staff
  ON public.offline_assignment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_assignments_update_own_or_staff
  ON public.offline_assignment_submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

CREATE POLICY offline_assignments_delete_own_or_staff
  ON public.offline_assignment_submissions FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (document->>'user_id') = ((select auth.uid())::text)
    OR (document->'coordinator_ids') ? ((select auth.uid())::text)
    OR (document->>'instructor_id') = ((select auth.uid())::text)
  );

-- -----------------------------------------------------------------------------
-- 3) Performance: auth_rls_initplan (wrap auth.* calls in SELECT)
--    Replace auth.uid() with (select auth.uid()) in hot policies.
-- -----------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS profiles_select_self_or_staff ON public.profiles;
CREATE POLICY profiles_select_self_or_staff
  ON public.profiles FOR SELECT
  USING (
    id = (select auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
  ON public.profiles FOR INSERT
  WITH CHECK (id = (select auth.uid()));

-- Merge UPDATE policies into one to avoid multiple permissive UPDATE policies
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;
CREATE POLICY profiles_update_self_or_staff
  ON public.profiles FOR UPDATE
  USING (
    id = (select auth.uid())
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    id = (select auth.uid())
    OR public.is_admin_or_support()
  );

-- courses
DROP POLICY IF EXISTS courses_select_public ON public.courses;
CREATE POLICY courses_select_public
  ON public.courses FOR SELECT
  USING (
    published = true
    OR instructor_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR (data->'co_instructor_permissions') ? ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS courses_insert_manager ON public.courses;
CREATE POLICY courses_insert_manager
  ON public.courses FOR INSERT
  WITH CHECK (
    instructor_id = (select auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS courses_update_manager ON public.courses;
CREATE POLICY courses_update_manager
  ON public.courses FOR UPDATE
  USING (
    instructor_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR (data->'co_instructor_permissions') ? ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS courses_delete_manager ON public.courses;
CREATE POLICY courses_delete_manager
  ON public.courses FOR DELETE
  USING (
    instructor_id = (select auth.uid())
    OR public.is_admin_or_support()
  );

-- course child tables (keep logic same, wrap auth.uid)
DROP POLICY IF EXISTS course_sections_all ON public.course_sections;
CREATE POLICY course_sections_all
  ON public.course_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS course_lessons_all ON public.course_lessons;
CREATE POLICY course_lessons_all
  ON public.course_lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS course_locales_all ON public.course_locales;
CREATE POLICY course_locales_all
  ON public.course_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS course_section_locales_all ON public.course_section_locales;
CREATE POLICY course_section_locales_all
  ON public.course_section_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS course_lesson_locales_all ON public.course_lesson_locales;
CREATE POLICY course_lesson_locales_all
  ON public.course_lesson_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

-- course_discounts: avoid SELECT overlap by making write policy only write actions
DROP POLICY IF EXISTS course_discounts_select ON public.course_discounts;
CREATE POLICY course_discounts_select
  ON public.course_discounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS course_discounts_write ON public.course_discounts;
CREATE POLICY course_discounts_insert
  ON public.course_discounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

CREATE POLICY course_discounts_update
  ON public.course_discounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

CREATE POLICY course_discounts_delete
  ON public.course_discounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

-- dashboard_configs: avoid SELECT overlap by restricting write policy to write actions
DROP POLICY IF EXISTS dashboard_configs_write_staff ON public.dashboard_configs;
CREATE POLICY dashboard_configs_write_staff
  ON public.dashboard_configs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY dashboard_configs_update_staff
  ON public.dashboard_configs FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY dashboard_configs_delete_staff
  ON public.dashboard_configs FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

-- lesson_progress: avoid SELECT overlap by making write policy write-only, wrap auth.uid
DROP POLICY IF EXISTS lesson_progress_write_own ON public.lesson_progress;
CREATE POLICY lesson_progress_insert_own
  ON public.lesson_progress FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY lesson_progress_update_own
  ON public.lesson_progress FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY lesson_progress_delete_own
  ON public.lesson_progress FOR DELETE
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS lesson_progress_select_own_or_staff ON public.lesson_progress;
CREATE POLICY lesson_progress_select_own_or_staff
  ON public.lesson_progress FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

-- contests: remove redundant staff ALL policy (other policies already include staff)
DROP POLICY IF EXISTS contests_write_staff ON public.contests;

-- Also wrap auth.uid() for initplan warning
DROP POLICY IF EXISTS contests_select ON public.contests;
CREATE POLICY contests_select
  ON public.contests FOR SELECT
  USING (
    status IN ('published', 'running', 'ended')
    OR public.is_admin_or_support()
    OR (document->>'created_by') = ((select auth.uid())::text)
  );

DROP POLICY IF EXISTS contests_insert_instructor_corelia ON public.contests;
CREATE POLICY contests_insert_instructor_corelia
  ON public.contests FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.current_profile_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (select auth.uid()) AND p.instructor_origin = 'corelia'
      )
    )
  );

DROP POLICY IF EXISTS contests_update_creator_staff ON public.contests;
CREATE POLICY contests_update_creator_staff
  ON public.contests FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (document->>'created_by') = ((select auth.uid())::text)
  );

-- enrollments: initplan (wrap auth.uid)
DROP POLICY IF EXISTS enrollments_select_own_or_course_staff ON public.enrollments;
CREATE POLICY enrollments_select_own_or_course_staff
  ON public.enrollments FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS enrollments_insert_self ON public.enrollments;
CREATE POLICY enrollments_insert_self
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS enrollments_update_own_or_staff ON public.enrollments;
CREATE POLICY enrollments_update_own_or_staff
  ON public.enrollments FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

-- course_payment_access: initplan
DROP POLICY IF EXISTS course_payment_access_select_own ON public.course_payment_access;
CREATE POLICY course_payment_access_select_own
  ON public.course_payment_access FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
  );

-- payment_transactions: initplan
DROP POLICY IF EXISTS payment_transactions_select_own ON public.payment_transactions;
CREATE POLICY payment_transactions_select_own
  ON public.payment_transactions FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
  );

-- final_assignment_submissions: initplan (wrap auth.uid)
DROP POLICY IF EXISTS fas_select ON public.final_assignment_submissions;
CREATE POLICY fas_select
  ON public.final_assignment_submissions FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

DROP POLICY IF EXISTS fas_insert_own ON public.final_assignment_submissions;
CREATE POLICY fas_insert_own
  ON public.final_assignment_submissions FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS fas_update_reviewers ON public.final_assignment_submissions;
CREATE POLICY fas_update_reviewers
  ON public.final_assignment_submissions FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = (select auth.uid())
          OR (c.data->'co_instructor_permissions') ? ((select auth.uid())::text)
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 4) Performance: add missing FK indexes flagged by lint
-- -----------------------------------------------------------------------------

-- contests
CREATE INDEX IF NOT EXISTS contest_reg_user_id_idx
  ON public.contest_registrations (user_id);
CREATE INDEX IF NOT EXISTS contest_sub_user_id_idx
  ON public.contest_submissions (user_id);

-- course_discounts audit FKs
CREATE INDEX IF NOT EXISTS course_discounts_created_by_idx
  ON public.course_discounts (created_by);
CREATE INDEX IF NOT EXISTS course_discounts_updated_by_idx
  ON public.course_discounts (updated_by);

-- course_lessons composite FK (course_id, section_id)
CREATE INDEX IF NOT EXISTS course_lessons_course_section_idx
  ON public.course_lessons (course_id, section_id);

-- payments / progress
CREATE INDEX IF NOT EXISTS course_payment_access_course_id_idx
  ON public.course_payment_access (course_id);
CREATE INDEX IF NOT EXISTS fas_user_id_idx
  ON public.final_assignment_submissions (user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_course_id_idx
  ON public.lesson_progress (course_id);

-- offline
CREATE INDEX IF NOT EXISTS offline_cohorts_offline_course_id_idx
  ON public.offline_cohorts (offline_course_id);
