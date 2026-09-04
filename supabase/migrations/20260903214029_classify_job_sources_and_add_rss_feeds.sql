BEGIN;

-- Make the operational distinction explicit. Aggregate feeds have one managed
-- scheduler target; only company-scoped ATS adapters require an admin-created
-- employer target.
ALTER TABLE public.job_sources
  ADD COLUMN ingestion_mode text GENERATED ALWAYS AS (
    CASE
      WHEN source_type IN ('greenhouse', 'lever', 'ashby', 'smartrecruiters')
        THEN 'company_scoped'
      WHEN source_type = 'rss' THEN 'rss'
      ELSE 'aggregate'
    END
  ) STORED;

COMMENT ON COLUMN public.job_sources.ingestion_mode IS
  'aggregate and rss sources run directly; company_scoped ATS sources require employer board targets';

-- New public RSS sources are intentionally disabled and policy-unreviewed.
-- Their endpoints were verified during development, but a Corelia admin must
-- approve redistribution terms before enabling them in an environment.
INSERT INTO public.job_sources (
  name, slug, source_type, base_url, adapter_config, default_crawl_hours,
  priority, enabled, attribution_required, attribution_text,
  canonical_link_required, allow_description_display, allow_seo_indexing,
  redistribution_notes, terms_url, policy_reviewed_at
) VALUES
  (
    'Remote First Jobs', 'remote-first-jobs-rss', 'rss',
    'https://remotefirstjobs.com/rss/jobs.rss',
    '{"feed_urls":["https://remotefirstjobs.com/rss/jobs.rss"],"max_jobs_per_run":25}'::jsonb,
    24, 55, false, true, 'Jobs sourced from Remote First Jobs', true, false, false,
    'Public RSS documentation permits use in aggregators; review the current terms and retain source attribution and canonical links before enabling.',
    'https://remotefirstjobs.com/rss', null
  ),
  (
    'Real Work From Anywhere', 'real-work-from-anywhere-rss', 'rss',
    'https://www.realworkfromanywhere.com/rss.xml',
    '{"feed_urls":["https://www.realworkfromanywhere.com/rss.xml"],"max_jobs_per_run":25}'::jsonb,
    24, 50, false, true, 'Jobs sourced from Real Work From Anywhere', true, false, false,
    'Public RSS feed verified; redistribution policy must be reviewed before enabling. Retain source attribution and canonical links.',
    'https://www.realworkfromanywhere.com/rss-feeds', null
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.job_companies (
  source_id, name, slug, website_url, careers_url, domains, source_type,
  source_identifier, source_region, crawl_interval_hours, priority,
  verified, active
)
SELECT
  source.id,
  source.name || ' feed',
  source.slug || '-feed',
  CASE source.slug
    WHEN 'remote-first-jobs-rss' THEN 'https://remotefirstjobs.com'
    ELSE 'https://www.realworkfromanywhere.com'
  END,
  source.base_url,
  ARRAY[]::text[],
  'rss',
  source.slug,
  'global',
  source.default_crawl_hours,
  source.priority,
  true,
  true
FROM public.job_sources AS source
WHERE source.slug IN ('remote-first-jobs-rss', 'real-work-from-anywhere-rss')
ON CONFLICT DO NOTHING;

COMMIT;
