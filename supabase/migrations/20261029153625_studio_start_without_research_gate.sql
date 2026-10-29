-- Starting a Studio run no longer depends on Catalog research or production rank.
-- Keep a matching latest production score's A1 job as optional brief context.
CREATE OR REPLACE FUNCTION private.studio_start_run(
  p_course_id uuid,
  p_run_id uuid,
  p_started_by uuid,
  p_resume_from uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_existing_course uuid;
  v_resume jsonb;
  v_catalog_job_id uuid;
BEGIN
  -- Lock the course first so concurrent starts of the same course are serialized.
  SELECT c.status INTO v_status
  FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT r.course_id INTO v_existing_course FROM public.studio_runs r WHERE r.id = p_run_id;
  IF FOUND THEN
    IF v_existing_course <> p_course_id THEN
      RAISE EXCEPTION 'run_id_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('run_id', p_run_id, 'created', false);
  END IF;

  IF v_status NOT IN ('idea', 'needs_update', 'not_passed') THEN
    RAISE EXCEPTION 'course_not_startable' USING ERRCODE = 'P0001', DETAIL = v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studio_course_paths p WHERE p.course_id = p_course_id) THEN
    RAISE EXCEPTION 'course_has_no_path' USING ERRCODE = 'P0001';
  END IF;

  -- Resolve only the latest production pass. Missing rank/score/job leaves brief context NULL.
  SELECT s.job_id INTO v_catalog_job_id
  FROM (
    SELECT r.id
    FROM public.studio_catalog_rankings r
    WHERE r.group_kind IS NULL
    ORDER BY r.computed_at DESC, r.id DESC
    LIMIT 1
  ) AS latest
  LEFT JOIN public.studio_catalog_scores s
    ON s.ranking_id = latest.id AND s.course_id = p_course_id;

  INSERT INTO public.studio_runs (id, course_id, started_by, catalog_job_id)
  VALUES (p_run_id, p_course_id, p_started_by, v_catalog_job_id);
  INSERT INTO public.studio_run_steps (run_id, step_key)
  SELECT p_run_id, k
  FROM unnest(ARRAY[
    'brief', 'research', 'curriculum', 'curriculum_review', 'lessons',
    'lesson_review', 'structure_check', 'journey_test', 'publish'
  ]) AS k;
  UPDATE public.studio_courses SET status = 'queued' WHERE id = p_course_id;

  IF p_resume_from IS NOT NULL THEN
    v_resume := private.studio_resume_run(p_run_id, p_course_id, p_resume_from);
  END IF;

  RETURN jsonb_build_object('run_id', p_run_id, 'created', true)
    || CASE
      WHEN v_resume IS NULL THEN '{}'::jsonb
      WHEN v_resume ? 'skipped' THEN jsonb_build_object('resume_skipped', v_resume -> 'skipped')
      ELSE jsonb_build_object('resume', v_resume)
    END;
END;
$$;

REVOKE ALL ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_start_run(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid), public.studio_start_run(uuid, uuid, uuid, uuid) TO service_role;
