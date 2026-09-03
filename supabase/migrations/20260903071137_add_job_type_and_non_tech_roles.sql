BEGIN;

INSERT INTO public.job_roles (slug, name, group_name, sort_order) VALUES
  ('product-management', 'Product Manager', 'Product & Program', 240),
  ('program-management', 'Program / Project Manager', 'Product & Program', 250),
  ('product-design', 'Product Designer', 'Design', 260),
  ('ux-ui-design', 'UX / UI Designer', 'Design', 270),
  ('social-media', 'Social Media', 'Marketing & Content', 280),
  ('content-marketing', 'Content Marketing', 'Marketing & Content', 290),
  ('product-marketing', 'Product Marketing', 'Marketing & Content', 300),
  ('growth-marketing', 'Growth Marketing', 'Marketing & Content', 310),
  ('marketing', 'Marketing', 'Marketing & Content', 320),
  ('communications-pr', 'Communications / PR', 'Marketing & Content', 330),
  ('community-management', 'Community Management', 'Community', 340),
  ('business-development', 'Business Development', 'Business', 350),
  ('partnerships', 'Partnerships', 'Business', 360),
  ('sales', 'Sales', 'Business', 370),
  ('customer-success', 'Customer Success', 'Customer', 380),
  ('customer-support', 'Customer Support', 'Customer', 390),
  ('operations', 'Operations', 'Operations', 400),
  ('finance-accounting', 'Finance / Accounting', 'Operations', 410),
  ('people-hr', 'People / HR', 'People', 420),
  ('recruiting', 'Recruiting', 'People', 430),
  ('legal-compliance', 'Legal / Compliance', 'Legal', 440)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  group_name = EXCLUDED.group_name,
  active = true,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.jobs
  ADD COLUMN job_type text NOT NULL DEFAULT 'tech'
  CONSTRAINT jobs_job_type_check CHECK (job_type IN ('tech', 'non_tech'));

-- Correct strong non-tech title signals immediately. Every listing will also
-- be reprocessed because the Edge classifier version changes with this schema.
UPDATE public.jobs
SET job_type = 'non_tech'
WHERE title ~* '\m(social|marketing|content|communications?|community|product manager|program manager|project manager|designer|business development|partnerships?|sales|account executive|customer success|customer support|operations|chief of staff|finance|accounting|accountant|recruiting|recruiter|talent acquisition|human resources|people partner|legal|counsel|compliance)\M';

-- Repair the concrete false-positive class that motivated this taxonomy. The
-- classifier still owns subsequent updates; explicit staff overrides win.
UPDATE public.jobs
SET primary_role = 'social-media',
    roles = ARRAY['social-media'],
    required_skills = '{}',
    preferred_skills = '{}',
    mentioned_skills = '{}'
WHERE title ~* '\msocial\M'
  AND NOT (manual_overrides ?| ARRAY[
    'job_type', 'primary_role', 'roles', 'required_skills',
    'preferred_skills', 'mentioned_skills'
  ]);

CREATE INDEX jobs_job_type_idx
  ON public.jobs (job_type, status, ranking_score DESC, posted_at DESC, id);

ALTER TABLE public.job_events
  ADD COLUMN job_type text NOT NULL DEFAULT 'tech'
  CONSTRAINT job_events_job_type_check CHECK (job_type IN ('tech', 'non_tech'));

UPDATE public.job_events
SET job_type = 'non_tech'
WHERE role IS NOT NULL
  AND role NOT IN (
    'frontend-engineering', 'backend-engineering', 'fullstack-engineering',
    'mobile-engineering', 'blockchain-engineering', 'smart-contract-engineering',
    'software-architecture', 'general-software-engineering', 'devops',
    'site-reliability-engineering', 'platform-engineering', 'cloud-engineering',
    'ai-engineering', 'machine-learning-engineering', 'data-engineering',
    'data-science', 'cybersecurity', 'qa-engineering', 'developer-relations',
    'technical-writing', 'solutions-engineering', 'technical-product-management',
    'engineering-management'
  );

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
      OLD.apply_url IS DISTINCT FROM NEW.apply_url OR
      OLD.job_type IS DISTINCT FROM NEW.job_type
    ) THEN
      v_event_type := 'job_updated';
    END IF;
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.job_events (
      job_id, event_type, source_id, company_id, job_type, role, domains,
      required_skills, preferred_skills, seniority, remote_type, country_codes,
      regions, salary_min, salary_max, salary_currency, salary_period
    ) VALUES (
      NEW.id, v_event_type, NEW.source_id, NEW.company_id, NEW.job_type,
      NEW.primary_role, NEW.domains, NEW.required_skills, NEW.preferred_skills,
      NEW.seniority, NEW.remote_type, NEW.country_codes, NEW.regions,
      NEW.salary_min, NEW.salary_max, NEW.salary_currency, NEW.salary_period
    );
  END IF;
  RETURN NEW;
END;
$$;

GRANT SELECT (job_type) ON public.jobs TO anon, authenticated;

COMMENT ON COLUMN public.jobs.job_type IS
  'High-level role classification: tech for technical delivery roles, non_tech for business and creative roles at tracked companies.';
COMMENT ON COLUMN public.job_events.job_type IS
  'Snapshot of the high-level job type when the lifecycle event was captured.';

COMMIT;
