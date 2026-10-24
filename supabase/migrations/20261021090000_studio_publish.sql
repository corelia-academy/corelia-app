-- Corelia Studio: who started a run, draft diagram images, and publishing a run as an app course.
--
--   studio_runs.started_by   the admin who pressed start (studio.start writes the authenticated user);
--                            becomes courses.instructor_id when the run is published.
--   studio_runs.app_course_id  set when the run created its course; makes publishing idempotent.
--   studio-drafts bucket     private, PNG only. <run_id>/<lesson_id>/<diagram_id>.png. Written by the
--                            service role; admins read through signed URLs.
--   studio_publish_course    writes courses, course_sections, course_lessons and
--                            course_section_questions of one run in ONE transaction. The learning
--                            publication guards are deferred constraint triggers, so they run at
--                            commit against the whole course: a course or lesson the app would not
--                            publish aborts the call, and nothing half-published is ever visible.
--                            The app course id is the Studio course id.

-- -----------------------------------------------------------------------------
-- 1) Who started a run, and the course a run created
-- -----------------------------------------------------------------------------

ALTER TABLE public.studio_runs
  ADD COLUMN started_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN app_course_id text;

DROP FUNCTION public.studio_start_run(uuid, uuid);
DROP FUNCTION private.studio_start_run(uuid, uuid);

CREATE FUNCTION private.studio_start_run(p_course_id uuid, p_run_id uuid, p_started_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_existing_course uuid;
BEGIN
  -- Lock the course first so concurrent starts of the same course are serialized.
  SELECT c.status INTO v_status FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
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

  INSERT INTO public.studio_runs (id, course_id, started_by) VALUES (p_run_id, p_course_id, p_started_by);
  INSERT INTO public.studio_run_steps (run_id, step_key)
  SELECT p_run_id, k
  FROM unnest(ARRAY[
    'brief', 'research', 'curriculum', 'curriculum_review', 'lessons',
    'lesson_review', 'structure_check', 'journey_test', 'publish'
  ]) AS k;
  UPDATE public.studio_courses SET status = 'queued' WHERE id = p_course_id;

  RETURN jsonb_build_object('run_id', p_run_id, 'created', true);
END;
$$;

CREATE FUNCTION public.studio_start_run(p_course_id uuid, p_run_id uuid, p_started_by uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_start_run(p_course_id, p_run_id, p_started_by);
$$;

REVOKE ALL ON FUNCTION private.studio_start_run(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_start_run(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.studio_start_run(uuid, uuid, uuid), public.studio_start_run(uuid, uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Draft diagram images
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-drafts', 'studio-drafts', false, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY studio_drafts_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-drafts' AND (SELECT public.studio_can_write()));

-- -----------------------------------------------------------------------------
-- 3) Publishing a run
-- -----------------------------------------------------------------------------

-- p_course: {slug, data}; p_sections: [{id, sort_order, data}]; p_lessons: [{id, section_id,
-- sort_order, data}]; p_questions: [{lesson_id, sort_order, data}]. Returns the app course id.
CREATE FUNCTION private.studio_publish_course(
  p_run_id uuid,
  p_course jsonb,
  p_sections jsonb,
  p_lessons jsonb,
  p_questions jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.studio_runs%ROWTYPE;
  v_course_id text;
  v_base text := coalesce(nullif(btrim(p_course->>'slug'), ''), 'course');
  v_slug text;
  v_n integer := 1;
  v_instructor_name text;
BEGIN
  -- Serialize publishing of one run; a repeated call returns the course the first call created.
  SELECT * INTO v_run FROM public.studio_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_run.app_course_id IS NOT NULL THEN
    RETURN v_run.app_course_id;
  END IF;
  IF v_run.started_by IS NULL THEN
    RAISE EXCEPTION 'run_has_no_owner' USING ERRCODE = 'P0001';
  END IF;

  v_course_id := v_run.course_id::text;
  IF EXISTS (SELECT 1 FROM public.courses WHERE id = v_course_id) THEN
    RAISE EXCEPTION 'course_id_taken' USING ERRCODE = 'P0001';
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.courses WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  SELECT coalesce(nullif(btrim(full_name), ''), 'Corelia') INTO v_instructor_name FROM public.profiles WHERE id = v_run.started_by;

  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES (
    v_course_id,
    v_run.started_by,
    true,
    v_slug,
    (p_course->'data') || jsonb_build_object('slug', v_slug, 'instructor_name', coalesce(v_instructor_name, 'Corelia'))
  );

  INSERT INTO public.course_sections (course_id, id, sort_order, data)
  SELECT v_course_id, s->>'id', (s->>'sort_order')::integer, s->'data'
  FROM jsonb_array_elements(p_sections) AS s;

  INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data, published)
  SELECT v_course_id, l->>'id', l->>'section_id', (l->>'sort_order')::integer, l->'data', true
  FROM jsonb_array_elements(p_lessons) AS l;

  INSERT INTO public.course_section_questions (course_id, lesson_id, sort_order, data)
  SELECT v_course_id, q->>'lesson_id', (q->>'sort_order')::integer, q->'data'
  FROM jsonb_array_elements(p_questions) AS q;

  UPDATE public.studio_runs SET app_course_id = v_course_id WHERE id = p_run_id;
  RETURN v_course_id;
END;
$$;

CREATE FUNCTION public.studio_publish_course(p_run_id uuid, p_course jsonb, p_sections jsonb, p_lessons jsonb, p_questions jsonb)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_publish_course(p_run_id, p_course, p_sections, p_lessons, p_questions);
$$;

REVOKE ALL ON FUNCTION private.studio_publish_course(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_publish_course(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.studio_publish_course(uuid, jsonb, jsonb, jsonb, jsonb), public.studio_publish_course(uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;
