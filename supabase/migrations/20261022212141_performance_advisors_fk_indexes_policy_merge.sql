-- Supabase performance advisors: unindexed_foreign_keys, no_primary_key and
-- multiple_permissive_policies. Policy merges keep the same effective access
-- per role/command: permissive policies are OR-ed, so each merged policy is the
-- OR of the policies it replaces.

-- ---------------------------------------------------------------------------
-- unindexed_foreign_keys: covering indexes for FK columns.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notification_actors_actor_idx
  ON private.notification_actors (actor);
CREATE INDEX IF NOT EXISTS course_section_questions_course_lesson_idx
  ON public.course_section_questions (course_id, lesson_id);
CREATE INDEX IF NOT EXISTS credential_issuances_revoked_by_idx
  ON public.credential_issuances (revoked_by);
CREATE INDEX IF NOT EXISTS email_audit_logs_actor_id_idx
  ON public.email_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS email_automation_enrollments_contact_id_idx
  ON public.email_automation_enrollments (contact_id);
CREATE INDEX IF NOT EXISTS email_automation_steps_sender_id_idx
  ON public.email_automation_steps (sender_id);
CREATE INDEX IF NOT EXISTS email_automation_steps_template_version_id_idx
  ON public.email_automation_steps (template_version_id);
CREATE INDEX IF NOT EXISTS email_automations_created_by_idx
  ON public.email_automations (created_by);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_contact_id_idx
  ON public.email_campaign_recipients (contact_id);
CREATE INDEX IF NOT EXISTS email_campaigns_created_by_idx
  ON public.email_campaigns (created_by);
CREATE INDEX IF NOT EXISTS email_campaigns_list_id_idx
  ON public.email_campaigns (list_id);
CREATE INDEX IF NOT EXISTS email_campaigns_sender_id_idx
  ON public.email_campaigns (sender_id);
CREATE INDEX IF NOT EXISTS email_campaigns_template_version_id_idx
  ON public.email_campaigns (template_version_id);
CREATE INDEX IF NOT EXISTS email_import_jobs_created_by_idx
  ON public.email_import_jobs (created_by);
CREATE INDEX IF NOT EXISTS email_import_jobs_list_id_idx
  ON public.email_import_jobs (list_id);
CREATE INDEX IF NOT EXISTS email_lists_created_by_idx
  ON public.email_lists (created_by);
CREATE INDEX IF NOT EXISTS email_senders_created_by_idx
  ON public.email_senders (created_by);
CREATE INDEX IF NOT EXISTS email_settings_updated_by_idx
  ON public.email_settings (updated_by);
CREATE INDEX IF NOT EXISTS email_template_versions_created_by_idx
  ON public.email_template_versions (created_by);
CREATE INDEX IF NOT EXISTS email_templates_created_by_idx
  ON public.email_templates (created_by);
CREATE INDEX IF NOT EXISTS feed_milestones_course_id_idx
  ON public.feed_milestones (course_id);
CREATE INDEX IF NOT EXISTS feed_milestones_hackathon_id_idx
  ON public.feed_milestones (hackathon_id);
CREATE INDEX IF NOT EXISTS feed_milestones_project_id_idx
  ON public.feed_milestones (project_id);
CREATE INDEX IF NOT EXISTS lesson_progress_course_lesson_idx
  ON public.lesson_progress (course_id, lesson_id);
CREATE INDEX IF NOT EXISTS pending_credential_issuances_granted_by_idx
  ON public.pending_credential_issuances (granted_by);
CREATE INDEX IF NOT EXISTS project_media_uploads_owner_id_idx
  ON public.project_media_uploads (owner_id);
CREATE INDEX IF NOT EXISTS project_slug_history_project_id_idx
  ON public.project_slug_history (project_id);
CREATE INDEX IF NOT EXISTS raw_jobs_canonical_job_id_idx
  ON public.raw_jobs (canonical_job_id);
CREATE INDEX IF NOT EXISTS raw_jobs_company_id_idx
  ON public.raw_jobs (company_id);
CREATE INDEX IF NOT EXISTS source_coverage_daily_company_id_idx
  ON public.source_coverage_daily (company_id);
CREATE INDEX IF NOT EXISTS source_coverage_daily_source_id_idx
  ON public.source_coverage_daily (source_id);
CREATE INDEX IF NOT EXISTS wallet_link_challenges_user_id_idx
  ON public.wallet_link_challenges (user_id);
CREATE INDEX IF NOT EXISTS xp_hackathon_project_seen_user_id_idx
  ON public.xp_hackathon_project_seen (user_id);

-- lesson_progress (course_id) is now a prefix of the composite FK index.
DROP INDEX IF EXISTS public.lesson_progress_course_id_idx;

-- ---------------------------------------------------------------------------
-- no_primary_key: private.xp_tracking_config is a single-row config table.
-- ---------------------------------------------------------------------------
ALTER TABLE private.xp_tracking_config
  ADD CONSTRAINT xp_tracking_config_pkey PRIMARY KEY (started_at);

-- ---------------------------------------------------------------------------
-- multiple_permissive_policies
-- ---------------------------------------------------------------------------

-- certificate_records: the staff FOR ALL policy overlapped select_own on SELECT.
DROP POLICY IF EXISTS certificate_records_all_staff ON public.certificate_records;
DROP POLICY IF EXISTS certificate_records_select_own ON public.certificate_records;
CREATE POLICY certificate_records_select_own_or_staff
  ON public.certificate_records FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_or_support());
CREATE POLICY certificate_records_insert_staff
  ON public.certificate_records FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY certificate_records_update_staff
  ON public.certificate_records FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY certificate_records_delete_staff
  ON public.certificate_records FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

-- courses: anon keeps learning_read; authenticated gets one merged SELECT policy.
DROP POLICY IF EXISTS learning_read ON public.courses;
DROP POLICY IF EXISTS learning_course_owner_read ON public.courses;
DROP POLICY IF EXISTS learning_operator_course_read ON public.courses;
CREATE POLICY learning_read
  ON public.courses FOR SELECT
  TO anon
  USING (
    private.can_manage_course_feature(id, (SELECT auth.uid()), 'content')
    OR (published AND archived_at IS NULL)
  );
CREATE POLICY learning_authenticated_read
  ON public.courses FOR SELECT
  TO authenticated
  USING (
    (published AND archived_at IS NULL)
    OR instructor_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
    OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'content')
    OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'students')
    OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'submissions')
    OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'certificates')
  );

-- credential_issuances: anon keeps the public-profile policy; authenticated
-- gets it folded into credential_issuances_select.
DROP POLICY IF EXISTS credential_issuances_select ON public.credential_issuances;
DROP POLICY IF EXISTS credential_issuances_select_public_profile ON public.credential_issuances;
CREATE POLICY credential_issuances_select_public_profile
  ON public.credential_issuances FOR SELECT
  TO anon
  USING (
    status = 'minted'
    AND show_on_profile = true
    AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL
  );
CREATE POLICY credential_issuances_select
  ON public.credential_issuances FOR SELECT
  TO authenticated
  USING (
    (
      status = 'minted'
      AND show_on_profile = true
      AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL
    )
    OR user_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
    OR (
      course_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_issuances.course_id
          AND (
            c.instructor_id = (SELECT auth.uid())
            OR (c.data -> 'co_instructor_permissions') ? ((SELECT auth.uid())::text)
          )
      )
    )
    OR (
      hackathon_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_issuances.hackathon_id
          AND (
            public.is_admin_or_support()
            OR (h.document ->> 'created_by') = ((SELECT auth.uid())::text)
          )
      )
    )
  );

-- credential_templates: same split as credential_issuances.
DROP POLICY IF EXISTS credential_templates_select ON public.credential_templates;
DROP POLICY IF EXISTS credential_templates_select_public_profile ON public.credential_templates;
CREATE POLICY credential_templates_select_public_profile
  ON public.credential_templates FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.template_id = credential_templates.id
        AND ci.status = 'minted'
        AND ci.show_on_profile = true
        AND NULLIF(btrim(ci.oc_credential_id), '') IS NOT NULL
    )
  );
CREATE POLICY credential_templates_select
  ON public.credential_templates FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.template_id = credential_templates.id
        AND (
          ci.user_id = (SELECT auth.uid())
          OR (
            ci.status = 'minted'
            AND ci.show_on_profile = true
            AND NULLIF(btrim(ci.oc_credential_id), '') IS NOT NULL
          )
        )
    )
    OR (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            c.instructor_id = (SELECT auth.uid())
            OR (c.data -> 'co_instructor_permissions') ? ((SELECT auth.uid())::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_templates.hackathon_id
          AND (h.document ->> 'created_by') = ((SELECT auth.uid())::text)
      )
    )
  );

-- profiles: merge self and staff UPDATE policies. The role-escalation guard
-- trigger on profiles is unaffected.
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;
CREATE POLICY profiles_update_self_or_staff
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) OR private.is_admin_or_support())
  WITH CHECK (id = (SELECT auth.uid()) OR private.is_admin_or_support());
