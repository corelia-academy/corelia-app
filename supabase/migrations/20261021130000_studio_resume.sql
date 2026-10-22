-- Corelia Studio: resume a failed run from its accepted work.
--
-- A run that ends as draft_failed has usually accepted most of its work (a run of 44 lessons can
-- fail on one). studio_start_run takes an optional p_resume_from: the new run starts with copies of
-- what the failed run had accepted, and only the rest is generated again, with a fresh budget.
--
--   Copied  the newest accepted generation of brief, research, curriculum and curriculum_review,
--           as far as those steps were done (a prefix: a step is not copied after one that was
--           not done; a curriculum that asked for more research is not a curriculum), for every lesson that was DONE (its newest accepted draft has an accepted
--           review with no blocking issue) that draft and that review, and for every lesson whose
--           newest accepted draft was never reviewed (the run stopped first) that draft alone.
--   Redone  every other lesson, from the start.
--
-- A copy keeps model_id, prompt_version, input, output and usage of the original, points to it with
-- parent_generation_id and has origin = 'resumed'. Its usage is the tokens spent producing it in the
-- failed run, so the cost of a run is the sum of usage over origin = 'ai' rows: summing every row
-- would count the copied work twice. provider_request_id is 'resume:<original id>' because the
-- original request id is unique per provider and a copy never called one.
--
-- Nothing is copied unless the failed run is the newest run of the same course, ended as
-- draft_failed, and finished at least its brief; then the call starts a normal run and says why.

ALTER TABLE public.studio_generations DROP CONSTRAINT studio_generations_origin_check;
ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_origin_check CHECK (origin IN ('ai', 'human_edit', 'external', 'resumed'));

-- Copies one accepted generation into the new run (attempt 0: it is the first accepted of its round).
CREATE FUNCTION private.studio_copy_generations(p_run_id uuid, p_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH copied AS (
    INSERT INTO public.studio_generations (
      run_id, step_key, lesson_id, attempt, agent_role, kind, origin, provider, requested_model_id, model_id,
      prompt_version, params, input, parent_generation_id, status, provider_request_id, output, usage,
      created_at, submitted_at, completed_at
    )
    SELECT p_run_id, g.step_key, g.lesson_id, 0, g.agent_role, g.kind, 'resumed', g.provider, g.requested_model_id, g.model_id,
           g.prompt_version, g.params, g.input, g.id, 'completed', 'resume:' || g.id::text, g.output, g.usage,
           g.created_at, g.submitted_at, g.completed_at
    FROM public.studio_generations g
    WHERE g.id = ANY (p_ids)
    RETURNING 1
  )
  SELECT count(*)::integer FROM copied;
$$;

CREATE FUNCTION private.studio_resume_run(p_run_id uuid, p_course_id uuid, p_from uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from public.studio_runs%ROWTYPE;
  v_step text;
  v_gen uuid;
  v_ids uuid[] := '{}';
  v_steps text[] := '{}';
  v_lessons uuid[];
  v_unreviewed uuid[];
  v_done_lessons integer;
  v_total integer;
BEGIN
  SELECT * INTO v_from FROM public.studio_runs WHERE id = p_from;
  IF NOT FOUND OR v_from.course_id <> p_course_id THEN
    RETURN jsonb_build_object('skipped', 'run_not_found');
  END IF;
  IF v_from.status <> 'draft_failed' THEN
    RETURN jsonb_build_object('skipped', 'run_not_draft_failed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_runs r WHERE r.course_id = p_course_id AND r.id NOT IN (p_run_id, p_from) AND r.started_at > v_from.started_at) THEN
    RETURN jsonb_build_object('skipped', 'not_latest_run');
  END IF;

  -- The steps before the lessons, as far as they were done.
  FOREACH v_step IN ARRAY ARRAY['brief', 'research', 'curriculum', 'curriculum_review'] LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.studio_run_steps s WHERE s.run_id = p_from AND s.step_key = v_step AND s.state = 'done');
    SELECT g.id INTO v_gen FROM public.studio_generations g
    WHERE g.run_id = p_from AND g.step_key = v_step AND g.lesson_id IS NULL AND g.status = 'completed'
      -- A curriculum that asked for more research is a request, not a curriculum.
      AND coalesce(g.output ->> 'status', '') <> 'needs_research'
    ORDER BY g.attempt DESC LIMIT 1;
    EXIT WHEN v_gen IS NULL;
    v_ids := v_ids || v_gen;
    v_steps := v_steps || v_step;
  END LOOP;
  IF cardinality(v_steps) = 0 THEN
    RETURN jsonb_build_object('skipped', 'nothing_done');
  END IF;

  -- Lessons that were done: as many accepted reviews as accepted drafts, the last review with no blocking issue.
  SELECT coalesce(array_agg(x.id), '{}') INTO v_lessons FROM (
    SELECT DISTINCT ON (g.step_key, g.lesson_id) g.id
    FROM public.studio_generations g
    WHERE g.run_id = p_from AND g.step_key IN ('lessons', 'lesson_review') AND g.status = 'completed'
      AND g.lesson_id IN (
        SELECT d.lesson_id
        FROM (SELECT lesson_id, count(*) AS n FROM public.studio_generations
              WHERE run_id = p_from AND step_key = 'lessons' AND status = 'completed' AND lesson_id IS NOT NULL GROUP BY lesson_id) d
        JOIN (SELECT lesson_id, count(*) AS n FROM public.studio_generations
              WHERE run_id = p_from AND step_key = 'lesson_review' AND status = 'completed' AND lesson_id IS NOT NULL GROUP BY lesson_id) r
          ON r.lesson_id = d.lesson_id AND r.n = d.n
        WHERE NOT EXISTS (
          SELECT 1
          FROM (SELECT output FROM public.studio_generations
                WHERE run_id = p_from AND step_key = 'lesson_review' AND status = 'completed' AND lesson_id = d.lesson_id
                ORDER BY attempt DESC LIMIT 1) last_review,
               jsonb_array_elements(last_review.output -> 'issues') i
          WHERE i ->> 'severity' = 'blocking'
        )
      )
    ORDER BY g.step_key, g.lesson_id, g.attempt DESC
  ) x;

  -- Lessons whose newest accepted draft has no review yet: keep the draft, the review is still to do.
  SELECT coalesce(array_agg(x.id), '{}') INTO v_unreviewed FROM (
    SELECT DISTINCT ON (g.lesson_id) g.id
    FROM public.studio_generations g
    WHERE g.run_id = p_from AND g.step_key = 'lessons' AND g.status = 'completed' AND g.lesson_id IN (
      SELECT d.lesson_id
      FROM (SELECT lesson_id, count(*) AS n FROM public.studio_generations
            WHERE run_id = p_from AND step_key = 'lessons' AND status = 'completed' AND lesson_id IS NOT NULL GROUP BY lesson_id) d
      LEFT JOIN (SELECT lesson_id, count(*) AS n FROM public.studio_generations
                 WHERE run_id = p_from AND step_key = 'lesson_review' AND status = 'completed' AND lesson_id IS NOT NULL GROUP BY lesson_id) r
        ON r.lesson_id = d.lesson_id
      WHERE d.n = coalesce(r.n, 0) + 1
    )
    ORDER BY g.lesson_id, g.attempt DESC
  ) x;

  PERFORM private.studio_copy_generations(p_run_id, v_ids || v_lessons || v_unreviewed);
  UPDATE public.studio_run_steps SET state = 'done' WHERE run_id = p_run_id AND step_key = ANY (v_steps);

  SELECT count(*)::integer INTO v_total
  FROM public.studio_generations c, jsonb_array_elements(c.output -> 'modules') m, jsonb_array_elements(m -> 'lessons') l
  WHERE c.run_id = p_run_id AND c.step_key = 'curriculum' AND c.lesson_id IS NULL;
  -- Each done lesson was copied as a draft and a review.
  v_done_lessons := cardinality(v_lessons) / 2;

  RETURN jsonb_build_object(
    'from_run_id', p_from,
    'steps', cardinality(v_steps),
    'lessons_copied', v_done_lessons,
    'drafts_copied', cardinality(v_unreviewed),
    'lessons_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION private.studio_copy_generations(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.studio_resume_run(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- studio_start_run gains p_resume_from; its result says what was copied or why nothing was.
DROP FUNCTION public.studio_start_run(uuid, uuid, uuid);
DROP FUNCTION private.studio_start_run(uuid, uuid, uuid);

CREATE FUNCTION private.studio_start_run(p_course_id uuid, p_run_id uuid, p_started_by uuid, p_resume_from uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_existing_course uuid;
  v_resume jsonb;
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

CREATE FUNCTION public.studio_start_run(p_course_id uuid, p_run_id uuid, p_started_by uuid, p_resume_from uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_start_run(p_course_id, p_run_id, p_started_by, p_resume_from);
$$;

REVOKE ALL ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_start_run(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid), public.studio_start_run(uuid, uuid, uuid, uuid) TO service_role;
