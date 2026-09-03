BEGIN;

-- The initial Tech/Non-tech backfill treated every title containing "social"
-- as a Social Media role. Restore strong engineering titles that use "social"
-- only as a product/team qualifier (for example, "Software Engineer: Social &
-- AI") while preserving explicit staff overrides.
UPDATE public.jobs
SET job_type = 'tech',
    primary_role = 'general-software-engineering',
    roles = ARRAY['general-software-engineering']
WHERE job_type = 'non_tech'
  AND primary_role = 'social-media'
  AND title ~* '\m(engineer|developer|architect|devops|devsecops|sre|data scientist)\M'
  AND NOT (manual_overrides ?| ARRAY['job_type', 'primary_role', 'roles']);

COMMIT;
