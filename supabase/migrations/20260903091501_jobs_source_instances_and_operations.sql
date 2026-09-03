-- A source row represents one provider/policy instance, while source_type
-- selects the adapter implementation. Multiple RSS providers therefore need
-- separate source rows even though they share the generic RSS adapter.

ALTER TABLE public.job_companies
  ADD COLUMN source_id uuid REFERENCES public.job_sources(id) ON DELETE RESTRICT;

UPDATE public.job_companies AS company
SET source_id = source.id
FROM public.job_sources AS source
WHERE source.source_type = company.source_type;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_companies WHERE source_id IS NULL) THEN
    RAISE EXCEPTION 'jobs_source_instance_backfill_failed';
  END IF;
END;
$$;

ALTER TABLE public.job_companies
  ALTER COLUMN source_id SET NOT NULL;

DROP INDEX IF EXISTS public.job_sources_source_type_unique;
DROP INDEX IF EXISTS public.job_companies_source_identity_unique;

CREATE INDEX job_sources_type_idx
  ON public.job_sources (source_type, enabled, priority DESC);

CREATE UNIQUE INDEX job_companies_source_identity_unique
  ON public.job_companies (source_id, lower(source_identifier), source_region);

CREATE INDEX job_companies_source_idx
  ON public.job_companies (source_id, active, priority DESC, last_success_at);

CREATE OR REPLACE FUNCTION private.jobs_company_sync_source_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_source_type text;
BEGIN
  SELECT source_type
  INTO v_source_type
  FROM public.job_sources
  WHERE id = NEW.source_id;

  IF v_source_type IS NULL THEN
    RAISE EXCEPTION 'job_source_not_found';
  END IF;

  NEW.source_type := v_source_type;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_company_sync_source_type_trigger
  BEFORE INSERT OR UPDATE OF source_id, source_type ON public.job_companies
  FOR EACH ROW EXECUTE FUNCTION private.jobs_company_sync_source_type();

REVOKE ALL ON FUNCTION private.jobs_company_sync_source_type()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.job_companies.source_id IS
  'Provider/policy instance used to crawl this target; source_type is synchronized from this row for adapter dispatch.';
