-- Add the first source-level Web3 feed. A managed crawl-target row lets the
-- existing company-oriented scheduler execute the feed without exposing the
-- provider token or treating it as browser configuration.

ALTER TABLE public.job_companies
  DROP CONSTRAINT IF EXISTS job_companies_source_type_check;

ALTER TABLE public.job_companies
  ADD CONSTRAINT job_companies_source_type_check
  CHECK (source_type IN ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'web3career'));

INSERT INTO public.job_sources (
  name,
  slug,
  source_type,
  base_url,
  adapter_config,
  default_crawl_hours,
  priority,
  enabled,
  attribution_required,
  attribution_text,
  canonical_link_required,
  allow_description_display,
  allow_seo_indexing,
  terms_url,
  policy_reviewed_at
) VALUES (
  'web3.career',
  'web3career',
  'web3career',
  'https://web3.career/api/v1',
  '{"limit": 25, "show_description": true}'::jsonb,
  24,
  90,
  false,
  true,
  'Jobs sourced from web3.career',
  true,
  true,
  true,
  'https://docs.bondex.app/api-reference/openapi-documentation/terms-of-use-mandatory-link-attribution',
  now()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.job_companies (
  name,
  slug,
  website_url,
  careers_url,
  domains,
  source_type,
  source_identifier,
  source_region,
  crawl_interval_hours,
  priority,
  verified,
  active
) VALUES (
  'web3.career feed',
  'web3career-feed',
  'https://web3.career',
  'https://web3.career/web3-jobs-api',
  ARRAY['web3'],
  'web3career',
  'latest',
  'global',
  24,
  90,
  true,
  true
)
ON CONFLICT DO NOTHING;
