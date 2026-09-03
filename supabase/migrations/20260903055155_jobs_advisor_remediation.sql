BEGIN;

-- Cover every Jobs foreign key reported by the Supabase performance advisor.
CREATE INDEX crawler_runs_company_id_idx ON public.crawler_runs (company_id);
CREATE INDEX crawler_runs_created_by_idx ON public.crawler_runs (created_by);
CREATE INDEX crawler_runs_source_id_idx ON public.crawler_runs (source_id);
CREATE INDEX job_events_source_id_idx ON public.job_events (source_id);

-- Each table gets one SELECT policy per role. Staff write policies are split by
-- command so they do not overlap the combined public/staff read policy.
DROP POLICY job_sources_public_read ON public.job_sources;
DROP POLICY job_sources_staff_manage ON public.job_sources;
CREATE POLICY job_sources_read ON public.job_sources FOR SELECT TO anon, authenticated
  USING (
    (enabled AND policy_reviewed_at IS NOT NULL)
    OR (SELECT public.is_admin_or_support())
  );
CREATE POLICY job_sources_staff_insert ON public.job_sources FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_sources_staff_update ON public.job_sources FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_sources_staff_delete ON public.job_sources FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY job_companies_public_read ON public.job_companies;
DROP POLICY job_companies_staff_manage ON public.job_companies;
CREATE POLICY job_companies_read ON public.job_companies FOR SELECT TO anon, authenticated
  USING (
    (active AND verified)
    OR (SELECT public.is_admin_or_support())
  );
CREATE POLICY job_companies_staff_insert ON public.job_companies FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_companies_staff_update ON public.job_companies FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_companies_staff_delete ON public.job_companies FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY job_roles_public_read ON public.job_roles;
DROP POLICY job_roles_staff_manage ON public.job_roles;
CREATE POLICY job_roles_read ON public.job_roles FOR SELECT TO anon, authenticated
  USING (active OR (SELECT public.is_admin_or_support()));
CREATE POLICY job_roles_staff_insert ON public.job_roles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_roles_staff_update ON public.job_roles FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_roles_staff_delete ON public.job_roles FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY job_domains_public_read ON public.job_domains;
DROP POLICY job_domains_staff_manage ON public.job_domains;
CREATE POLICY job_domains_read ON public.job_domains FOR SELECT TO anon, authenticated
  USING (active OR (SELECT public.is_admin_or_support()));
CREATE POLICY job_domains_staff_insert ON public.job_domains FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_domains_staff_update ON public.job_domains FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_domains_staff_delete ON public.job_domains FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY job_skills_public_read ON public.job_skills;
DROP POLICY job_skills_staff_manage ON public.job_skills;
CREATE POLICY job_skills_read ON public.job_skills FOR SELECT TO anon, authenticated
  USING (active OR (SELECT public.is_admin_or_support()));
CREATE POLICY job_skills_staff_insert ON public.job_skills FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_skills_staff_update ON public.job_skills FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));
CREATE POLICY job_skills_staff_delete ON public.job_skills FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY jobs_public_read ON public.jobs;
DROP POLICY jobs_staff_read ON public.jobs;
CREATE POLICY jobs_read ON public.jobs FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND EXISTS (
        SELECT 1 FROM public.job_sources s
        WHERE s.id = jobs.source_id
          AND s.enabled
          AND s.policy_reviewed_at IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.job_companies c
        WHERE c.id = jobs.company_id
          AND c.active
          AND c.verified
      )
    )
    OR (SELECT public.is_admin_or_support())
  );

DROP POLICY job_source_links_public_read ON public.job_source_links;
DROP POLICY job_source_links_staff_read ON public.job_source_links;
CREATE POLICY job_source_links_read ON public.job_source_links FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_source_links.job_id)
    OR (SELECT public.is_admin_or_support())
  );

COMMIT;
