BEGIN;

-- Corelia Jobs MVP. Public discovery data is intentionally separated from
-- operational ingestion data so the browser never receives raw payloads,
-- classifier evidence, or crawler configuration beyond reviewed source policy.

CREATE TABLE public.job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'greenhouse', 'lever', 'ashby', 'smartrecruiters',
    'cryptojobslist', 'web3career', 'himalayas', 'weworkremotely',
    'remotive', 'remoteok', 'custom_api', 'rss'
  )),
  base_url text,
  adapter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_crawl_hours integer NOT NULL DEFAULT 24 CHECK (default_crawl_hours BETWEEN 6 AND 168),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  enabled boolean NOT NULL DEFAULT true,
  attribution_required boolean NOT NULL DEFAULT false,
  attribution_text text,
  canonical_link_required boolean NOT NULL DEFAULT true,
  allow_description_display boolean NOT NULL DEFAULT true,
  allow_seo_indexing boolean NOT NULL DEFAULT true,
  redistribution_notes text,
  terms_url text,
  policy_reviewed_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX job_sources_slug_lower_unique ON public.job_sources (lower(slug));
CREATE UNIQUE INDEX job_sources_source_type_unique ON public.job_sources (source_type);
CREATE INDEX job_sources_due_idx ON public.job_sources (enabled, priority DESC, last_success_at);

CREATE TABLE public.job_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  website_url text,
  careers_url text,
  domains text[] NOT NULL DEFAULT '{}',
  headquarters text,
  source_type text NOT NULL CHECK (source_type IN ('greenhouse', 'lever', 'ashby', 'smartrecruiters')),
  source_identifier text NOT NULL,
  source_region text NOT NULL DEFAULT 'global' CHECK (source_region IN ('global', 'eu')),
  crawl_interval_hours integer CHECK (crawl_interval_hours BETWEEN 6 AND 168),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_crawled_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX job_companies_slug_lower_unique ON public.job_companies (lower(slug));
CREATE UNIQUE INDEX job_companies_source_identity_unique
  ON public.job_companies (source_type, lower(source_identifier), source_region);
CREATE INDEX job_companies_due_idx ON public.job_companies (active, priority DESC, last_success_at);
CREATE INDEX job_companies_domains_gin ON public.job_companies USING gin (domains);

CREATE TABLE public.job_roles (
  slug text PRIMARY KEY,
  name text NOT NULL,
  group_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.job_domains (
  slug text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.job_skills (
  slug text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX job_skills_aliases_gin ON public.job_skills USING gin (aliases);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  company_id uuid REFERENCES public.job_companies(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  company_logo_url text,
  description_html text,
  description_plain text,
  summary text,
  primary_role text REFERENCES public.job_roles(slug) ON UPDATE CASCADE,
  roles text[] NOT NULL DEFAULT '{}',
  domains text[] NOT NULL DEFAULT '{}',
  required_skills text[] NOT NULL DEFAULT '{}',
  preferred_skills text[] NOT NULL DEFAULT '{}',
  mentioned_skills text[] NOT NULL DEFAULT '{}',
  seniority text CHECK (seniority IS NULL OR seniority IN ('intern', 'fresher', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive')),
  experience_min_years numeric CHECK (experience_min_years IS NULL OR experience_min_years >= 0),
  experience_max_years numeric CHECK (experience_max_years IS NULL OR experience_max_years >= experience_min_years),
  employment_type text CHECK (employment_type IS NULL OR employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'volunteer', 'other')),
  remote_type text CHECK (remote_type IS NULL OR remote_type IN ('remote', 'hybrid', 'onsite', 'unknown')),
  location_text text,
  country_codes text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  remote_eligibility text,
  salary_min numeric CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max numeric CHECK (salary_max IS NULL OR salary_max >= salary_min),
  salary_currency text,
  salary_period text CHECK (salary_period IS NULL OR salary_period IN ('hour', 'day', 'week', 'month', 'year')),
  source_id uuid NOT NULL REFERENCES public.job_sources(id) ON DELETE RESTRICT,
  source_job_id text NOT NULL,
  source_url text NOT NULL,
  canonical_url text NOT NULL,
  apply_url text NOT NULL,
  posted_at timestamptz,
  source_updated_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'active', 'rejected', 'expired', 'disabled', 'duplicate')),
  review_reason text,
  quality_score numeric CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100),
  classification_confidence numeric CHECK (classification_confidence IS NULL OR classification_confidence BETWEEN 0 AND 1),
  classifier_version text,
  input_hash text,
  payload_hash text NOT NULL,
  fingerprint text NOT NULL,
  ranking_score numeric NOT NULL DEFAULT 0,
  manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jobs_slug_lower_unique ON public.jobs (lower(slug));
CREATE UNIQUE INDEX jobs_source_identity_unique ON public.jobs (source_id, source_job_id);
CREATE INDEX jobs_public_feed_idx ON public.jobs (status, ranking_score DESC, posted_at DESC, id);
CREATE INDEX jobs_company_idx ON public.jobs (company_id, status, posted_at DESC);
CREATE INDEX jobs_primary_role_idx ON public.jobs (primary_role, status, posted_at DESC);
CREATE INDEX jobs_remote_type_idx ON public.jobs (remote_type, status, posted_at DESC);
CREATE INDEX jobs_seniority_idx ON public.jobs (seniority, status, posted_at DESC);
CREATE INDEX jobs_roles_gin ON public.jobs USING gin (roles);
CREATE INDEX jobs_domains_gin ON public.jobs USING gin (domains);
CREATE INDEX jobs_required_skills_gin ON public.jobs USING gin (required_skills);
CREATE INDEX jobs_preferred_skills_gin ON public.jobs USING gin (preferred_skills);
CREATE INDEX jobs_country_codes_gin ON public.jobs USING gin (country_codes);
CREATE INDEX jobs_regions_gin ON public.jobs USING gin (regions);
CREATE INDEX jobs_search_vector_gin ON public.jobs USING gin (search_vector);

CREATE TABLE public.raw_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.job_sources(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.job_companies(id) ON DELETE SET NULL,
  source_job_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'unchanged', 'rejected', 'failed')),
  processed_at timestamptz,
  processing_error text,
  canonical_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX raw_jobs_payload_identity_unique
  ON public.raw_jobs (source_id, source_job_id, payload_hash);
CREATE INDEX raw_jobs_processing_idx ON public.raw_jobs (processing_status, fetched_at);

CREATE TABLE public.job_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.job_sources(id) ON DELETE RESTRICT,
  source_job_id text NOT NULL,
  source_url text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_job_id)
);

CREATE INDEX job_source_links_job_idx ON public.job_source_links (job_id);

CREATE TABLE public.job_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  model text NOT NULL,
  classifier_version text NOT NULL,
  output jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score numeric CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, input_hash, classifier_version)
);

CREATE INDEX job_classifications_job_idx ON public.job_classifications (job_id, created_at DESC);

CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('job_published', 'job_updated', 'job_expired', 'job_reactivated')),
  source_id uuid NOT NULL REFERENCES public.job_sources(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.job_companies(id) ON DELETE SET NULL,
  role text,
  domains text[] NOT NULL DEFAULT '{}',
  required_skills text[] NOT NULL DEFAULT '{}',
  preferred_skills text[] NOT NULL DEFAULT '{}',
  seniority text,
  remote_type text,
  country_codes text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_period text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_events_occurred_idx ON public.job_events (occurred_at DESC, event_type);
CREATE INDEX job_events_job_idx ON public.job_events (job_id, occurred_at DESC);
CREATE INDEX job_events_company_idx ON public.job_events (company_id, occurred_at DESC);

CREATE TABLE public.user_jobs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  saved boolean NOT NULL DEFAULT false,
  applied boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  saved_at timestamptz,
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id),
  CHECK (saved OR applied OR hidden)
);

CREATE INDEX user_jobs_saved_idx ON public.user_jobs (user_id, saved_at DESC) WHERE saved;
CREATE INDEX user_jobs_applied_idx ON public.user_jobs (user_id, applied_at DESC) WHERE applied;

CREATE TABLE public.crawler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.job_sources(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.job_companies(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'retry')),
  target_type text NOT NULL CHECK (target_type IN ('source', 'company', 'adapter', 'all', 'revalidation', 'analytics')),
  target_value text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
  fetched_count integer NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
  new_raw_count integer NOT NULL DEFAULT 0 CHECK (new_raw_count >= 0),
  unchanged_count integer NOT NULL DEFAULT 0 CHECK (unchanged_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  ai_queued_count integer NOT NULL DEFAULT 0 CHECK (ai_queued_count >= 0),
  published_count integer NOT NULL DEFAULT 0 CHECK (published_count >= 0),
  review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  expired_count integer NOT NULL DEFAULT 0 CHECK (expired_count >= 0),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX crawler_runs_started_idx ON public.crawler_runs (started_at DESC);
CREATE INDEX crawler_runs_target_idx ON public.crawler_runs (target_type, target_value, started_at DESC);

CREATE TABLE public.source_coverage_daily (
  date date NOT NULL,
  source_id uuid NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.job_companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  crawl_success boolean NOT NULL,
  active_jobs integer NOT NULL DEFAULT 0 CHECK (active_jobs >= 0),
  new_jobs integer NOT NULL DEFAULT 0 CHECK (new_jobs >= 0),
  PRIMARY KEY (date, source_id, company_id)
);

CREATE TABLE public.market_daily_stats (
  date date PRIMARY KEY,
  active_jobs integer NOT NULL DEFAULT 0,
  new_jobs integer NOT NULL DEFAULT 0,
  expired_jobs integer NOT NULL DEFAULT 0,
  remote_jobs integer NOT NULL DEFAULT 0,
  entry_level_jobs integer NOT NULL DEFAULT 0,
  salary_jobs integer NOT NULL DEFAULT 0,
  comparable_new_jobs integer NOT NULL DEFAULT 0,
  comparable_total_jobs integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.market_role_daily_stats (
  date date NOT NULL,
  role text NOT NULL,
  new_jobs integer NOT NULL DEFAULT 0,
  active_jobs integer NOT NULL DEFAULT 0,
  expired_jobs integer NOT NULL DEFAULT 0,
  remote_jobs integer NOT NULL DEFAULT 0,
  comparable_new_jobs integer NOT NULL DEFAULT 0,
  comparable_total_jobs integer NOT NULL DEFAULT 0,
  PRIMARY KEY (date, role)
);

CREATE TABLE public.market_skill_daily_stats (
  date date NOT NULL,
  skill text NOT NULL,
  role text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT '',
  new_jobs integer NOT NULL DEFAULT 0,
  active_jobs integer NOT NULL DEFAULT 0,
  expired_jobs integer NOT NULL DEFAULT 0,
  required_count integer NOT NULL DEFAULT 0,
  preferred_count integer NOT NULL DEFAULT 0,
  comparable_new_jobs integer NOT NULL DEFAULT 0,
  comparable_total_jobs integer NOT NULL DEFAULT 0,
  PRIMARY KEY (date, skill, role, domain)
);

CREATE TABLE public.market_domain_daily_stats (
  date date NOT NULL,
  domain text NOT NULL,
  new_jobs integer NOT NULL DEFAULT 0,
  active_jobs integer NOT NULL DEFAULT 0,
  comparable_new_jobs integer NOT NULL DEFAULT 0,
  comparable_total_jobs integer NOT NULL DEFAULT 0,
  PRIMARY KEY (date, domain)
);

COMMENT ON TABLE public.job_sources IS 'CANONICAL_CONFIG: Reviewed Jobs ingestion sources and display policy';
COMMENT ON TABLE public.job_companies IS 'CANONICAL_ENTITY: Verified employer ATS board registry for Jobs ingestion';
COMMENT ON TABLE public.job_roles IS 'CANONICAL_REFERENCE: Jobs role taxonomy';
COMMENT ON TABLE public.job_domains IS 'CANONICAL_REFERENCE: Jobs domain taxonomy';
COMMENT ON TABLE public.job_skills IS 'CANONICAL_REFERENCE: Jobs skill taxonomy and deterministic aliases';
COMMENT ON TABLE public.jobs IS 'CANONICAL_ENTITY: Curated normalized technology job listings';
COMMENT ON TABLE public.raw_jobs IS 'AUDIT_LOG: Immutable-by-policy source payload versions for Jobs processing';
COMMENT ON TABLE public.job_source_links IS 'DERIVED_PROJECTION: Alternate source identities linked to canonical jobs';
COMMENT ON TABLE public.job_classifications IS 'AUDIT_LOG: Versioned Jobs classifier output and evidence';
COMMENT ON TABLE public.job_events IS 'EVENT_LOG: Append-only canonical Jobs lifecycle events';
COMMENT ON TABLE public.user_jobs IS 'CANONICAL_USER_STATE: Per-user saved, applied, and hidden job state';
COMMENT ON TABLE public.crawler_runs IS 'AUDIT_LOG: Jobs ingestion and analytics run outcomes';
COMMENT ON TABLE public.source_coverage_daily IS 'DERIVED_AGGREGATE: Daily successful source-company coverage observations';
COMMENT ON TABLE public.market_daily_stats IS 'DERIVED_AGGREGATE: Daily visible Jobs market totals';
COMMENT ON TABLE public.market_role_daily_stats IS 'DERIVED_AGGREGATE: Daily Jobs market totals by canonical role';
COMMENT ON TABLE public.market_skill_daily_stats IS 'DERIVED_AGGREGATE: Daily Jobs market totals by canonical skill';
COMMENT ON TABLE public.market_domain_daily_stats IS 'DERIVED_AGGREGATE: Daily Jobs market totals by canonical domain';

CREATE OR REPLACE FUNCTION private.jobs_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.required_skills, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.preferred_skills, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.roles, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.domains, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description_plain, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_before_write_trigger
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.jobs_before_write();

CREATE OR REPLACE FUNCTION private.capture_job_lifecycle_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    v_event_type := 'job_published';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'active' AND NEW.status = 'active' THEN
      v_event_type := CASE WHEN OLD.status = 'expired' THEN 'job_reactivated' ELSE 'job_published' END;
    ELSIF OLD.status = 'active' AND NEW.status = 'expired' THEN
      v_event_type := 'job_expired';
    ELSIF OLD.status = 'active' AND NEW.status = 'active' AND (
      OLD.payload_hash IS DISTINCT FROM NEW.payload_hash OR
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.description_plain IS DISTINCT FROM NEW.description_plain OR
      OLD.apply_url IS DISTINCT FROM NEW.apply_url
    ) THEN
      v_event_type := 'job_updated';
    END IF;
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.job_events (
      job_id, event_type, source_id, company_id, role, domains, required_skills,
      preferred_skills, seniority, remote_type, country_codes, regions,
      salary_min, salary_max, salary_currency, salary_period
    ) VALUES (
      NEW.id, v_event_type, NEW.source_id, NEW.company_id, NEW.primary_role, NEW.domains,
      NEW.required_skills, NEW.preferred_skills, NEW.seniority,
      NEW.remote_type, NEW.country_codes, NEW.regions, NEW.salary_min,
      NEW.salary_max, NEW.salary_currency, NEW.salary_period
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_lifecycle_event_trigger
  AFTER INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.capture_job_lifecycle_event();

REVOKE ALL ON FUNCTION private.jobs_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_job_lifecycle_event() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_coverage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_role_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_skill_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_domain_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_sources_public_read ON public.job_sources FOR SELECT TO anon, authenticated
  USING (enabled AND policy_reviewed_at IS NOT NULL);
CREATE POLICY job_sources_staff_manage ON public.job_sources FOR ALL TO authenticated
  USING (public.is_admin_or_support()) WITH CHECK (public.is_admin_or_support());

CREATE POLICY job_companies_public_read ON public.job_companies FOR SELECT TO anon, authenticated
  USING (active AND verified);
CREATE POLICY job_companies_staff_manage ON public.job_companies FOR ALL TO authenticated
  USING (public.is_admin_or_support()) WITH CHECK (public.is_admin_or_support());

CREATE POLICY job_roles_public_read ON public.job_roles FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY job_roles_staff_manage ON public.job_roles FOR ALL TO authenticated
  USING (public.is_admin_or_support()) WITH CHECK (public.is_admin_or_support());
CREATE POLICY job_domains_public_read ON public.job_domains FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY job_domains_staff_manage ON public.job_domains FOR ALL TO authenticated
  USING (public.is_admin_or_support()) WITH CHECK (public.is_admin_or_support());
CREATE POLICY job_skills_public_read ON public.job_skills FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY job_skills_staff_manage ON public.job_skills FOR ALL TO authenticated
  USING (public.is_admin_or_support()) WITH CHECK (public.is_admin_or_support());

CREATE POLICY jobs_public_read ON public.jobs FOR SELECT TO anon, authenticated
  USING (
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
  );
CREATE POLICY jobs_staff_read ON public.jobs FOR SELECT TO authenticated
  USING (public.is_admin_or_support());

CREATE POLICY raw_jobs_staff_read ON public.raw_jobs FOR SELECT TO authenticated
  USING (public.is_admin_or_support());
CREATE POLICY job_classifications_staff_read ON public.job_classifications FOR SELECT TO authenticated
  USING (public.is_admin_or_support());
CREATE POLICY job_events_staff_read ON public.job_events FOR SELECT TO authenticated
  USING (public.is_admin_or_support());
CREATE POLICY crawler_runs_staff_read ON public.crawler_runs FOR SELECT TO authenticated
  USING (public.is_admin_or_support());
CREATE POLICY source_coverage_staff_read ON public.source_coverage_daily FOR SELECT TO authenticated
  USING (public.is_admin_or_support());

CREATE POLICY job_source_links_public_read ON public.job_source_links FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_source_links.job_id));
CREATE POLICY job_source_links_staff_read ON public.job_source_links FOR SELECT TO authenticated
  USING (public.is_admin_or_support());

CREATE POLICY user_jobs_read_own ON public.user_jobs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_jobs_insert_own ON public.user_jobs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_jobs_update_own ON public.user_jobs FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_jobs_delete_own ON public.user_jobs FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY market_daily_public_read ON public.market_daily_stats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY market_role_public_read ON public.market_role_daily_stats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY market_skill_public_read ON public.market_skill_daily_stats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY market_domain_public_read ON public.market_domain_daily_stats FOR SELECT TO anon, authenticated USING (true);
-- Supabase projects may carry permissive default privileges for new public
-- tables. Reset them before applying this feature's explicit grant matrix.
REVOKE ALL ON public.job_sources, public.job_companies, public.job_roles,
  public.job_domains, public.job_skills, public.jobs, public.raw_jobs,
  public.job_source_links, public.job_classifications, public.job_events,
  public.user_jobs, public.crawler_runs, public.source_coverage_daily,
  public.market_daily_stats, public.market_role_daily_stats,
  public.market_skill_daily_stats, public.market_domain_daily_stats
  FROM anon, authenticated;

GRANT SELECT (id, name, slug, enabled, policy_reviewed_at, attribution_required, attribution_text, allow_seo_indexing)
  ON public.job_sources TO anon, authenticated;
GRANT SELECT (id, name, slug, logo_url, website_url, careers_url, domains, headquarters, active, verified)
  ON public.job_companies TO anon, authenticated;
GRANT SELECT ON public.job_roles, public.job_domains, public.job_skills,
  public.market_daily_stats, public.market_role_daily_stats,
  public.market_skill_daily_stats, public.market_domain_daily_stats
  TO anon, authenticated;
GRANT SELECT (
  id, slug, title, company_id, company_name, company_logo_url,
  description_html, description_plain, summary, primary_role, roles, domains,
  required_skills, preferred_skills, mentioned_skills, seniority,
  experience_min_years, experience_max_years, employment_type, remote_type,
  location_text, country_codes, regions, remote_eligibility, salary_min,
  salary_max, salary_currency, salary_period, source_id, source_job_id,
  source_url, canonical_url, apply_url, posted_at, first_seen_at, last_seen_at,
  expires_at, status, ranking_score, search_vector, created_at, updated_at
) ON public.jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_roles, public.job_domains,
  public.job_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_jobs TO authenticated;
GRANT ALL ON public.job_sources, public.job_companies, public.job_roles,
  public.job_domains, public.job_skills, public.jobs, public.raw_jobs,
  public.job_source_links, public.job_classifications, public.job_events,
  public.user_jobs, public.crawler_runs, public.source_coverage_daily,
  public.market_daily_stats, public.market_role_daily_stats,
  public.market_skill_daily_stats, public.market_domain_daily_stats
  TO service_role;

INSERT INTO public.job_sources (
  name, slug, source_type, base_url, default_crawl_hours, priority,
  attribution_required, canonical_link_required, terms_url, policy_reviewed_at
) VALUES
  ('Greenhouse', 'greenhouse', 'greenhouse', 'https://boards-api.greenhouse.io', 24, 100, false, true, 'https://developers.greenhouse.io/job-board.html', now()),
  ('Lever', 'lever', 'lever', 'https://api.lever.co', 24, 95, false, true, 'https://github.com/lever/postings-api', now()),
  ('Ashby', 'ashby', 'ashby', 'https://api.ashbyhq.com', 24, 95, false, true, 'https://developers.ashbyhq.com/docs/public-job-posting-api', now()),
  ('SmartRecruiters', 'smartrecruiters', 'smartrecruiters', 'https://api.smartrecruiters.com', 24, 85, false, true, 'https://developers.smartrecruiters.com/docs/posting-api', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.job_roles (slug, name, group_name, sort_order) VALUES
  ('frontend-engineering', 'Frontend Engineer', 'Software Engineering', 10),
  ('backend-engineering', 'Backend Engineer', 'Software Engineering', 20),
  ('fullstack-engineering', 'Full Stack Engineer', 'Software Engineering', 30),
  ('mobile-engineering', 'Mobile Engineer', 'Software Engineering', 40),
  ('blockchain-engineering', 'Blockchain Engineer', 'Software Engineering', 50),
  ('smart-contract-engineering', 'Smart Contract Engineer', 'Software Engineering', 60),
  ('software-architecture', 'Software Architect', 'Software Engineering', 70),
  ('general-software-engineering', 'Software Engineer', 'Software Engineering', 80),
  ('devops', 'DevOps Engineer', 'Infrastructure', 90),
  ('site-reliability-engineering', 'Site Reliability Engineer', 'Infrastructure', 100),
  ('platform-engineering', 'Platform Engineer', 'Infrastructure', 110),
  ('cloud-engineering', 'Cloud Engineer', 'Infrastructure', 120),
  ('ai-engineering', 'AI Engineer', 'AI & Data', 130),
  ('machine-learning-engineering', 'Machine Learning Engineer', 'AI & Data', 140),
  ('data-engineering', 'Data Engineer', 'AI & Data', 150),
  ('data-science', 'Data Scientist', 'AI & Data', 160),
  ('cybersecurity', 'Security Engineer', 'Security', 170),
  ('qa-engineering', 'QA Engineer', 'Quality', 180),
  ('developer-relations', 'Developer Relations', 'Developer Ecosystem', 190),
  ('technical-writing', 'Technical Writer', 'Developer Ecosystem', 200),
  ('solutions-engineering', 'Solutions Engineer', 'Developer Ecosystem', 210),
  ('technical-product-management', 'Technical Product Manager', 'Leadership', 220),
  ('engineering-management', 'Engineering Manager', 'Leadership', 230)
ON CONFLICT DO NOTHING;

INSERT INTO public.job_domains (slug, name, sort_order) VALUES
  ('ai', 'AI', 10), ('web3', 'Web3', 20), ('fintech', 'Fintech', 30),
  ('saas', 'SaaS', 40), ('cloud', 'Cloud', 50), ('developer-tools', 'Developer Tools', 60),
  ('cybersecurity', 'Cybersecurity', 70), ('gaming', 'Gaming', 80),
  ('ecommerce', 'E-commerce', 90), ('edtech', 'EdTech', 100),
  ('healthtech', 'HealthTech', 110), ('data-infrastructure', 'Data Infrastructure', 120),
  ('enterprise-software', 'Enterprise Software', 130), ('open-source', 'Open Source', 140),
  ('consumer', 'Consumer', 150), ('robotics', 'Robotics', 160),
  ('iot', 'IoT', 170), ('general-software', 'General Software', 180)
ON CONFLICT DO NOTHING;

INSERT INTO public.job_skills (slug, name, category, aliases, sort_order) VALUES
  ('javascript', 'JavaScript', 'Languages', ARRAY['javascript', 'js'], 10),
  ('typescript', 'TypeScript', 'Languages', ARRAY['typescript', 'ts'], 20),
  ('python', 'Python', 'Languages', ARRAY['python'], 30),
  ('rust', 'Rust', 'Languages', ARRAY['rust'], 40),
  ('go', 'Go', 'Languages', ARRAY['go', 'golang'], 50),
  ('java', 'Java', 'Languages', ARRAY['java'], 60),
  ('kotlin', 'Kotlin', 'Languages', ARRAY['kotlin'], 70),
  ('swift', 'Swift', 'Languages', ARRAY['swift'], 80),
  ('solidity', 'Solidity', 'Languages', ARRAY['solidity'], 90),
  ('react', 'React', 'Frontend', ARRAY['react', 'react.js', 'reactjs'], 100),
  ('nextjs', 'Next.js', 'Frontend', ARRAY['next.js', 'nextjs'], 110),
  ('vue', 'Vue', 'Frontend', ARRAY['vue', 'vue.js', 'vuejs'], 120),
  ('angular', 'Angular', 'Frontend', ARRAY['angular'], 130),
  ('svelte', 'Svelte', 'Frontend', ARRAY['svelte'], 140),
  ('tailwind', 'Tailwind CSS', 'Frontend', ARRAY['tailwind', 'tailwind css'], 150),
  ('nodejs', 'Node.js', 'Backend', ARRAY['node.js', 'nodejs'], 160),
  ('nestjs', 'NestJS', 'Backend', ARRAY['nestjs', 'nest.js'], 170),
  ('django', 'Django', 'Backend', ARRAY['django'], 180),
  ('fastapi', 'FastAPI', 'Backend', ARRAY['fastapi'], 190),
  ('graphql', 'GraphQL', 'Backend', ARRAY['graphql'], 200),
  ('grpc', 'gRPC', 'Backend', ARRAY['grpc'], 210),
  ('postgresql', 'PostgreSQL', 'Database', ARRAY['postgresql', 'postgres', 'postgre sql'], 220),
  ('mysql', 'MySQL', 'Database', ARRAY['mysql'], 230),
  ('mongodb', 'MongoDB', 'Database', ARRAY['mongodb', 'mongo db'], 240),
  ('redis', 'Redis', 'Database', ARRAY['redis'], 250),
  ('docker', 'Docker', 'Infrastructure', ARRAY['docker'], 260),
  ('kubernetes', 'Kubernetes', 'Infrastructure', ARRAY['kubernetes', 'k8s'], 270),
  ('aws', 'AWS', 'Infrastructure', ARRAY['aws', 'amazon web services'], 280),
  ('gcp', 'Google Cloud', 'Infrastructure', ARRAY['gcp', 'google cloud'], 290),
  ('azure', 'Azure', 'Infrastructure', ARRAY['azure'], 300),
  ('terraform', 'Terraform', 'Infrastructure', ARRAY['terraform'], 310),
  ('machine-learning', 'Machine Learning', 'AI', ARRAY['machine learning'], 320),
  ('llm', 'Large Language Models', 'AI', ARRAY['llm', 'large language model'], 330),
  ('pytorch', 'PyTorch', 'AI', ARRAY['pytorch'], 340),
  ('tensorflow', 'TensorFlow', 'AI', ARRAY['tensorflow'], 350),
  ('ethereum', 'Ethereum', 'Web3', ARRAY['ethereum'], 360),
  ('solana', 'Solana', 'Web3', ARRAY['solana'], 370),
  ('smart-contracts', 'Smart Contracts', 'Web3', ARRAY['smart contract', 'smart contracts'], 380)
ON CONFLICT DO NOTHING;

COMMIT;
