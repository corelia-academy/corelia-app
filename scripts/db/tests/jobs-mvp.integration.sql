DO $test$
DECLARE
  v_missing text;
  v_rls_missing text;
  v_source_id uuid;
BEGIN
  SELECT string_agg(expected.name, ', ')
  INTO v_missing
  FROM (VALUES
    ('job_sources'), ('job_companies'), ('job_roles'), ('job_domains'),
    ('job_skills'), ('jobs'), ('raw_jobs'), ('job_source_links'),
    ('job_classifications'), ('job_events'), ('user_jobs'), ('crawler_runs'),
    ('source_coverage_daily'), ('market_daily_stats'),
    ('market_role_daily_stats'), ('market_skill_daily_stats'),
    ('market_domain_daily_stats'), ('market_seniority_daily_stats'),
    ('job_operational_alerts')
  ) AS expected(name)
  WHERE to_regclass('public.' || expected.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Jobs MVP relations are missing: %', v_missing;
  END IF;

  SELECT string_agg(c.relname, ', ')
  INTO v_rls_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'job_sources', 'job_companies', 'job_roles', 'job_domains', 'job_skills',
      'jobs', 'raw_jobs', 'job_source_links', 'job_classifications', 'job_events',
      'user_jobs', 'crawler_runs', 'source_coverage_daily', 'market_daily_stats',
      'market_role_daily_stats', 'market_skill_daily_stats', 'market_domain_daily_stats',
      'market_seniority_daily_stats', 'job_operational_alerts'
    )
    AND NOT c.relrowsecurity;
  IF v_rls_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Jobs MVP relations without RLS: %', v_rls_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crawler_runs'
      AND column_name = 'failed_count'
      AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'crawler_runs.failed_count is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crawler_runs'
      AND column_name = 'ai_failed_count'
      AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'crawler_runs.ai_failed_count is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_companies'
      AND column_name = 'source_id' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_companies'
      AND column_name = 'last_revalidated_at'
  ) THEN
    RAISE EXCEPTION 'Jobs provider instance or revalidation columns are missing';
  END IF;

  IF (SELECT count(*) FROM public.job_sources) <> 12
    OR NOT EXISTS (
      SELECT 1 FROM public.job_sources
      WHERE slug = 'cryptojobslist'
        AND base_url = 'https://api.cryptojobslist.com/public/jobs'
        AND enabled = false
        AND policy_reviewed_at IS NULL
        AND allow_description_display = true
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.job_companies AS company
      JOIN public.job_sources AS source ON source.id = company.source_id
      WHERE company.slug = 'cryptojobslist-feed'
        AND source.slug = 'cryptojobslist'
    )
    OR (SELECT count(*) FROM public.job_sources
        WHERE slug IN ('remote-first-jobs-rss', 'real-work-from-anywhere-rss')
          AND ingestion_mode = 'rss'
          AND enabled = false
          AND policy_reviewed_at IS NULL) <> 2
    OR (SELECT count(*)
        FROM public.job_companies AS company
        JOIN public.job_sources AS source ON source.id = company.source_id
        WHERE source.slug IN ('remote-first-jobs-rss', 'real-work-from-anywhere-rss')
          AND company.source_type = 'rss'
          AND company.active = true
          AND company.verified = true) <> 2
  THEN
    RAISE EXCEPTION 'Jobs direct source inventory or CryptoJobsList policy gate is incomplete';
  END IF;

  IF (SELECT count(*) FROM cron.job WHERE jobname LIKE 'corelia-jobs-%') <> 3
    OR NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'corelia-jobs-discovery'
        AND schedule = '7 * * * *'
        AND command LIKE '%''mode'', ''discovery''%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'corelia-jobs-revalidation'
        AND schedule = '17 */6 * * *'
        AND command LIKE '%''mode'', ''revalidation''%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'corelia-jobs-analytics'
        AND schedule = '30 4 * * *'
        AND command LIKE '%''mode'', ''analytics''%'
    )
    OR EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname LIKE 'corelia-jobs-%'
        AND command NOT LIKE '%vault.decrypted_secrets%'
    )
  THEN
    RAISE EXCEPTION 'Jobs Vault-backed schedules are missing or misconfigured';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('crawler_runs_company_id_idx'),
      ('crawler_runs_created_by_idx'),
      ('crawler_runs_source_id_idx'),
      ('job_events_source_id_idx')
    ) AS expected(name)
    WHERE to_regclass('public.' || expected.name) IS NULL
  ) THEN
    RAISE EXCEPTION 'Jobs foreign-key advisor indexes are missing';
  END IF;

  IF EXISTS (
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'job_sources', 'job_companies', 'job_roles', 'job_domains',
        'job_skills', 'jobs', 'job_source_links'
      )
      AND cmd = 'SELECT'
    GROUP BY tablename
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Jobs tables have overlapping SELECT policies';
  END IF;

  IF has_table_privilege('anon', 'public.raw_jobs', 'SELECT')
    OR has_table_privilege('anon', 'public.job_classifications', 'SELECT')
    OR has_table_privilege('anon', 'public.crawler_runs', 'SELECT')
    OR has_table_privilege('anon', 'public.source_coverage_daily', 'SELECT')
    OR has_table_privilege('anon', 'public.job_operational_alerts', 'SELECT')
  THEN
    RAISE EXCEPTION 'Anonymous clients can read private Jobs operations data';
  END IF;
  IF has_table_privilege('anon', 'public.jobs', 'INSERT')
    OR has_table_privilege('anon', 'public.user_jobs', 'SELECT')
    OR has_table_privilege('authenticated', 'public.jobs', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.raw_jobs', 'INSERT')
    OR has_table_privilege('authenticated', 'public.job_classifications', 'INSERT')
    OR has_table_privilege('authenticated', 'public.crawler_runs', 'INSERT')
    OR has_table_privilege('authenticated', 'public.job_operational_alerts', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.market_daily_stats', 'UPDATE')
  THEN
    RAISE EXCEPTION 'Jobs write boundary grants are broader than intended';
  END IF;
  IF has_column_privilege('anon', 'public.jobs', 'manual_overrides', 'SELECT')
    OR has_column_privilege('authenticated', 'public.jobs', 'payload_hash', 'SELECT')
    OR has_column_privilege('anon', 'public.job_sources', 'last_error', 'SELECT')
    OR has_column_privilege('authenticated', 'public.job_companies', 'source_identifier', 'SELECT')
  THEN
    RAISE EXCEPTION 'Jobs public column grants expose operational metadata';
  END IF;
  IF NOT has_column_privilege('anon', 'public.jobs', 'ranking_score', 'SELECT')
    OR NOT has_column_privilege('anon', 'public.jobs', 'search_vector', 'SELECT')
    OR NOT has_column_privilege('anon', 'public.jobs', 'job_type', 'SELECT')
    OR NOT has_column_privilege('anon', 'public.job_companies', 'source_id', 'SELECT')
    OR NOT has_column_privilege('authenticated', 'public.job_companies', 'source_id', 'SELECT')
  THEN
    RAISE EXCEPTION 'Jobs catalog or connected adapters cannot use the public column grants';
  END IF;

  SELECT id INTO v_source_id FROM public.job_sources WHERE source_type = 'greenhouse';
  INSERT INTO public.job_companies (
    id, source_id, name, slug, source_type, source_identifier, verified
  ) VALUES (
    '00000000-0000-4000-8000-000000000991', v_source_id, 'Jobs Test Company',
    'jobs-test-company', 'greenhouse', 'jobs-test-company', false
  );
  INSERT INTO public.jobs (
    id, slug, title, company_id, company_name, primary_role, roles, domains,
    required_skills, mentioned_skills, source_id, source_job_id, source_url,
    canonical_url, apply_url, status, payload_hash, fingerprint
  ) VALUES (
    '00000000-0000-4000-8000-000000000992', 'jobs-test-company-backend-engineer',
    'Backend Engineer', '00000000-0000-4000-8000-000000000991',
    'Jobs Test Company', 'backend-engineering', ARRAY['backend-engineering'],
    ARRAY['developer-tools'], ARRAY['postgresql'], ARRAY['postgresql'],
    v_source_id, 'jobs-test-1', 'https://example.test/jobs/1',
    'https://example.test/jobs/1', 'https://example.test/jobs/1/apply',
    'active', 'payload-test-1', 'fingerprint-test-1'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.job_events
    WHERE job_id = '00000000-0000-4000-8000-000000000992'
      AND event_type = 'job_published'
      AND job_type = 'tech'
  ) THEN
    RAISE EXCEPTION 'Active Jobs insert did not create a lifecycle event';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = '00000000-0000-4000-8000-000000000992'
      AND search_vector @@ websearch_to_tsquery('simple', 'PostgreSQL')
  ) THEN
    RAISE EXCEPTION 'Jobs search vector was not populated';
  END IF;

  EXECUTE 'SET LOCAL ROLE anon';
  IF EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = '00000000-0000-4000-8000-000000000992'
  ) THEN
    RAISE EXCEPTION 'Anonymous clients can see a job from an unverified company';
  END IF;
  EXECUTE 'RESET ROLE';

  UPDATE public.job_companies
  SET verified = true
  WHERE id = '00000000-0000-4000-8000-000000000991';

  EXECUTE 'SET LOCAL ROLE anon';
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = '00000000-0000-4000-8000-000000000992'
  ) THEN
    RAISE EXCEPTION 'Anonymous clients cannot see a valid published job';
  END IF;
  PERFORM id
  FROM public.jobs
  WHERE search_vector @@ websearch_to_tsquery('simple', 'Backend PostgreSQL')
  ORDER BY ranking_score DESC, posted_at DESC NULLS LAST, id
  LIMIT 1;
  EXECUTE 'RESET ROLE';

  DELETE FROM public.jobs
  WHERE id = '00000000-0000-4000-8000-000000000992';
  DELETE FROM public.job_companies
  WHERE id = '00000000-0000-4000-8000-000000000991';
END;
$test$;
