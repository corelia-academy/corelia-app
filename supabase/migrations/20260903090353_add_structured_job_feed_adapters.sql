-- Register structured public feeds behind the existing source policy gates.
-- They remain disabled until Staging crawl volume and classification cost are
-- reviewed. Managed feed-target rows let the company-oriented scheduler run
-- source-level feeds without exposing credentials or adding a parallel queue.

ALTER TABLE public.job_companies
  DROP CONSTRAINT IF EXISTS job_companies_source_type_check;

ALTER TABLE public.job_companies
  ADD CONSTRAINT job_companies_source_type_check
  CHECK (source_type IN (
    'greenhouse', 'lever', 'ashby', 'smartrecruiters', 'cryptojobslist',
    'web3career', 'himalayas', 'weworkremotely', 'remotive', 'remoteok', 'rss'
  ));

INSERT INTO public.job_sources (
  name, slug, source_type, base_url, adapter_config, default_crawl_hours,
  priority, enabled, attribution_required, attribution_text,
  canonical_link_required, allow_description_display, allow_seo_indexing,
  redistribution_notes, terms_url, policy_reviewed_at
) VALUES
  (
    'Himalayas', 'himalayas', 'himalayas', 'https://himalayas.app/jobs/api',
    '{"pagination":"cursor","page_size":20}'::jsonb, 24, 80, false, true,
    'Jobs sourced from Himalayas', true, true, true,
    'Link each listing back to Himalayas and visibly identify Himalayas as the source.',
    'https://himalayas.app/docs/remote-jobs-api', now()
  ),
  (
    'We Work Remotely', 'weworkremotely', 'weworkremotely',
    'https://weworkremotely.com/remote-jobs.rss',
    '{"feed_urls":["https://weworkremotely.com/remote-jobs.rss"]}'::jsonb,
    24, 75, false, true, 'Jobs sourced from We Work Remotely', true, true, true,
    'Use the official RSS feed and link each listing back to We Work Remotely.',
    'https://weworkremotely.com/remote-job-rss-feed', now()
  ),
  (
    'Remotive', 'remotive', 'remotive', 'https://remotive.com/api/remote-jobs',
    '{}'::jsonb, 24, 65, false, true, 'Jobs sourced from Remotive', true, true,
    false,
    'Listings are delayed; link back to Remotive, name Remotive as source, do not gate access behind signup, and do not submit listings to third-party job/search platforms.',
    'https://remotive.com/remote-jobs/api', now()
  ),
  (
    'Remote OK', 'remoteok', 'remoteok', 'https://remoteok.com/api',
    '{}'::jsonb, 24, 60, false, true, 'Jobs sourced from Remote OK', true, true,
    true,
    'Use a follow link to the Remote OK listing, visibly name Remote OK as source, and do not use the Remote OK logo without permission.',
    'https://remoteok.com/api', now()
  ),
  (
    'CryptoJobsList', 'cryptojobslist', 'cryptojobslist',
    'https://cryptojobslist.com/api-access', '{}'::jsonb, 24, 70, false, true,
    'Jobs sourced from CryptoJobsList', true, false, false,
    'Adapter and redistribution policy remain unverified; do not enable.',
    'https://cryptojobslist.com/api-access', null
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.job_companies (
  name, slug, website_url, careers_url, domains, source_type,
  source_identifier, source_region, crawl_interval_hours, priority,
  verified, active
) VALUES
  ('Himalayas feed', 'himalayas-feed', 'https://himalayas.app',
   'https://himalayas.app/jobs', ARRAY[]::text[], 'himalayas', 'latest',
   'global', 24, 80, true, true),
  ('We Work Remotely feed', 'weworkremotely-feed', 'https://weworkremotely.com',
   'https://weworkremotely.com/remote-jobs', ARRAY[]::text[],
   'weworkremotely', 'latest', 'global', 24, 75, true, true),
  ('Remotive feed', 'remotive-feed', 'https://remotive.com',
   'https://remotive.com/remote-jobs', ARRAY[]::text[], 'remotive', 'latest',
   'global', 24, 65, true, true),
  ('Remote OK feed', 'remoteok-feed', 'https://remoteok.com',
   'https://remoteok.com/remote-jobs', ARRAY[]::text[], 'remoteok', 'latest',
   'global', 24, 60, true, true)
ON CONFLICT DO NOTHING;
