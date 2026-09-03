-- Register the now-documented CryptoJobsList JSON API contract. The source
-- remains disabled and policy-unreviewed until a project-specific API key and
-- redistribution terms have been approved for the target environment.

UPDATE public.job_sources
SET base_url = 'https://api.cryptojobslist.com/public/jobs',
    adapter_config = '{"page_size":100,"max_jobs_per_run":25}'::jsonb,
    attribution_required = true,
    attribution_text = 'Jobs sourced from CryptoJobsList',
    canonical_link_required = true,
    allow_description_display = true,
    allow_seo_indexing = false,
    redistribution_notes = 'API access is approved per use case. Every displayed listing must link to the provider canonicalURL; enable only after the project API key and granted terms are recorded.',
    terms_url = 'https://cryptojobslist.com/api-access',
    policy_reviewed_at = NULL,
    enabled = false,
    updated_at = now()
WHERE slug = 'cryptojobslist';

-- External aggregate feeds can contain thousands of rows. Keep the first
-- staged rollout within one Edge invocation; because this is a rolling window,
-- absence from a capped response is never treated as proof of expiry.
UPDATE public.job_sources
SET adapter_config = adapter_config || '{"max_jobs_per_run":25}'::jsonb,
    updated_at = now()
WHERE slug IN ('web3career', 'himalayas', 'weworkremotely', 'remotive', 'remoteok');

INSERT INTO public.job_companies (
  source_id, name, slug, website_url, careers_url, domains, source_type,
  source_identifier, source_region, crawl_interval_hours, priority,
  verified, active
)
SELECT
  source.id,
  'CryptoJobsList feed',
  'cryptojobslist-feed',
  'https://cryptojobslist.com',
  'https://cryptojobslist.com',
  ARRAY['web3']::text[],
  'cryptojobslist',
  'latest',
  'global',
  24,
  70,
  true,
  true
FROM public.job_sources AS source
WHERE source.slug = 'cryptojobslist'
ON CONFLICT DO NOTHING;
