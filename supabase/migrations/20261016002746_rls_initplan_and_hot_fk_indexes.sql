-- Supabase performance advisor: auth_rls_initplan. Wrapping auth.uid() in a
-- scalar subquery lets Postgres evaluate it once per statement, not per row.
-- Policy semantics, roles and commands are unchanged.
DROP POLICY IF EXISTS courses_delete_manager ON public.courses;
CREATE POLICY courses_delete_manager
  ON public.courses FOR DELETE
  USING (instructor_id = (SELECT auth.uid()) OR private.is_admin_or_support());

DROP POLICY IF EXISTS user_point_ledger_select_own ON public.user_point_ledger;
CREATE POLICY user_point_ledger_select_own
  ON public.user_point_ledger FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS connected_wallets_owner_read ON public.connected_wallets;
CREATE POLICY connected_wallets_owner_read
  ON public.connected_wallets FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Covering indexes for user-facing foreign keys flagged by unindexed_foreign_keys
-- (cascade deletes and per-user lookups).
CREATE INDEX IF NOT EXISTS lesson_progress_course_id_idx
  ON public.lesson_progress (course_id);
CREATE INDEX IF NOT EXISTS project_hearts_user_id_idx
  ON public.project_hearts (user_id);
CREATE INDEX IF NOT EXISTS feed_milestone_likes_user_id_idx
  ON public.feed_milestone_likes (user_id);
CREATE INDEX IF NOT EXISTS hackathon_registrations_user_id_idx
  ON public.hackathon_registrations (user_id);
CREATE INDEX IF NOT EXISTS hackathon_submissions_user_id_idx
  ON public.hackathon_submissions (user_id);
CREATE INDEX IF NOT EXISTS user_jobs_job_id_idx
  ON public.user_jobs (job_id);
