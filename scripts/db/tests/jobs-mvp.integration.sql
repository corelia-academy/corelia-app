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
    ('market_domain_daily_stats')
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
      'market_role_daily_stats', 'market_skill_daily_stats', 'market_domain_daily_stats'
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

  IF has_table_privilege('anon', 'public.raw_jobs', 'SELECT')
    OR has_table_privilege('anon', 'public.job_classifications', 'SELECT')
    OR has_table_privilege('anon', 'public.crawler_runs', 'SELECT')
    OR has_table_privilege('anon', 'public.source_coverage_daily', 'SELECT')
  THEN
    RAISE EXCEPTION 'Anonymous clients can read private Jobs operations data';
  END IF;
  IF has_table_privilege('anon', 'public.jobs', 'INSERT')
    OR has_table_privilege('anon', 'public.user_jobs', 'SELECT')
    OR has_table_privilege('authenticated', 'public.jobs', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.raw_jobs', 'INSERT')
    OR has_table_privilege('authenticated', 'public.job_classifications', 'INSERT')
    OR has_table_privilege('authenticated', 'public.crawler_runs', 'INSERT')
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
  THEN
    RAISE EXCEPTION 'Jobs catalog cannot order or search with the anonymous column grants';
  END IF;

  SELECT id INTO v_source_id FROM public.job_sources WHERE source_type = 'greenhouse';
  INSERT INTO public.job_companies (
    id, name, slug, source_type, source_identifier, verified
  ) VALUES (
    '00000000-0000-4000-8000-000000000991', 'Jobs Test Company',
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
