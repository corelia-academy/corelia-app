-- studio_purge_expired_drafts deletes only drafts (idea, no path) whose last edit is older than the TTL
-- and that have no run or research job; client roles cannot call it.
BEGIN;

INSERT INTO public.studio_courses(id,title,status,updated_at) VALUES
  ('eeee0001-0000-4000-8000-000000000001','draft old','idea',now() - interval '31 days'),
  ('eeee0001-0000-4000-8000-000000000002','draft recent','idea',now() - interval '29 days'),
  ('eeee0001-0000-4000-8000-000000000003','old with path','idea',now() - interval '40 days'),
  ('eeee0001-0000-4000-8000-000000000004','old with job','idea',now() - interval '40 days'),
  ('eeee0001-0000-4000-8000-000000000005','old with run','idea',now() - interval '40 days'),
  ('eeee0001-0000-4000-8000-000000000006','old published','published',now() - interval '40 days');
INSERT INTO public.studio_paths(id,group_kind,slug,title) VALUES ('eeee0001-1111-4000-8000-000000000001','skill','expire-drafts-test','Expire test');
INSERT INTO public.studio_course_paths(course_id,path_id) VALUES ('eeee0001-0000-4000-8000-000000000003','eeee0001-1111-4000-8000-000000000001');
INSERT INTO public.studio_catalog_jobs(course_id,trigger) VALUES ('eeee0001-0000-4000-8000-000000000004','manual');
INSERT INTO public.studio_runs(id,course_id) VALUES ('eeee0001-2222-4000-8000-000000000001','eeee0001-0000-4000-8000-000000000005');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_deleted integer;
  v_left text;
BEGIN
  v_deleted := public.studio_purge_expired_drafts(interval '30 days');
  IF v_deleted < 1 THEN RAISE EXCEPTION 'expected the old draft to be deleted, got %', v_deleted; END IF;
  IF EXISTS (SELECT 1 FROM public.studio_courses WHERE id = 'eeee0001-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'expired draft survived';
  END IF;
  SELECT string_agg(title, ',' ORDER BY title) INTO v_left FROM public.studio_courses WHERE id::text LIKE 'eeee0001-0000-4000-8000-00000000000%';
  IF v_left <> 'draft recent,old published,old with job,old with path,old with run' THEN
    RAISE EXCEPTION 'unexpected survivors: %', v_left;
  END IF;
  IF public.studio_purge_expired_drafts(interval '30 days') <> 0 THEN RAISE EXCEPTION 'second pass must find nothing'; END IF;

  -- A stricter TTL reaches the recent draft too.
  v_deleted := public.studio_purge_expired_drafts(interval '10 days');
  IF v_deleted < 1 OR EXISTS (SELECT 1 FROM public.studio_courses WHERE id = 'eeee0001-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'ttl is not respected';
  END IF;

  BEGIN
    PERFORM public.studio_purge_expired_drafts(interval '0');
    RAISE EXCEPTION 'zero ttl must be rejected';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'invalid_ttl' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Client roles cannot call it.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(r, 'public.studio_purge_expired_drafts(interval)', 'EXECUTE')
       OR has_function_privilege(r, 'private.studio_purge_expired_drafts(interval)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can purge drafts', r;
    END IF;
  END LOOP;
END $$;

ROLLBACK;
