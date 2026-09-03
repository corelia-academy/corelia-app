ALTER TABLE public.job_sources
  ADD COLUMN last_revalidated_at timestamptz,
  ADD COLUMN last_revalidation_error text;

ALTER TABLE public.job_companies
  ADD COLUMN last_revalidated_at timestamptz,
  ADD COLUMN last_revalidation_error text;

CREATE TABLE public.market_seniority_daily_stats (
  date date NOT NULL,
  seniority text NOT NULL,
  new_jobs integer NOT NULL DEFAULT 0 CHECK (new_jobs >= 0),
  active_jobs integer NOT NULL DEFAULT 0 CHECK (active_jobs >= 0),
  comparable_new_jobs integer NOT NULL DEFAULT 0 CHECK (comparable_new_jobs >= 0),
  comparable_total_jobs integer NOT NULL DEFAULT 0 CHECK (comparable_total_jobs >= 0),
  PRIMARY KEY (date, seniority)
);

COMMENT ON TABLE public.market_seniority_daily_stats IS
  'DERIVED_AGGREGATE: Daily Jobs market totals by seniority';

ALTER TABLE public.market_seniority_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_seniority_public_read
  ON public.market_seniority_daily_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.market_seniority_daily_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.market_seniority_daily_stats TO anon, authenticated;
GRANT ALL ON public.market_seniority_daily_stats TO service_role;

CREATE TABLE public.job_operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.job_sources(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.job_companies(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN (
    'consecutive_failures',
    'unexpected_zero_jobs',
    'api_schema_change',
    'rate_limited',
    'classification_failure_spike',
    'dead_link_spike'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX job_operational_alerts_open_idx
  ON public.job_operational_alerts (last_seen_at DESC, severity)
  WHERE resolved_at IS NULL;

CREATE INDEX job_operational_alerts_source_idx
  ON public.job_operational_alerts (source_id, last_seen_at DESC);

CREATE INDEX job_operational_alerts_company_idx
  ON public.job_operational_alerts (company_id, last_seen_at DESC);

CREATE INDEX job_operational_alerts_resolved_by_idx
  ON public.job_operational_alerts (resolved_by)
  WHERE resolved_by IS NOT NULL;

-- At most one unresolved alert of a given kind exists for each source/company
-- pair. COALESCE makes provider-wide alerts and company-specific alerts stable
-- keys without exposing alert writes to browser clients.
CREATE UNIQUE INDEX job_operational_alerts_open_identity_unique
  ON public.job_operational_alerts (
    alert_type,
    COALESCE(source_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.job_operational_alerts IS
  'AUDIT_LOG: Deduplicated staff-visible alerts raised by Jobs ingestion and revalidation';

ALTER TABLE public.job_operational_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_operational_alerts_staff_read
  ON public.job_operational_alerts
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin_or_support()));

REVOKE ALL ON public.job_operational_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.job_operational_alerts TO authenticated;
GRANT ALL ON public.job_operational_alerts TO service_role;
