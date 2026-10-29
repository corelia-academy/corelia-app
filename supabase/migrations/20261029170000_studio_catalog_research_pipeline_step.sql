-- A1 Catalog research is step 0 of every newly started Studio run.
-- Its generation remains owned by studio_catalog_jobs; studio_generations' ownership constraint
-- is intentionally unchanged.

-- `step_key` is text, but the table has a CHECK constraint (not an enum), so widen that contract.
ALTER TABLE public.studio_run_steps DROP CONSTRAINT studio_run_steps_step_key_check;
ALTER TABLE public.studio_run_steps
  ADD CONSTRAINT studio_run_steps_step_key_check CHECK (step_key IN (
    'catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review', 'lessons',
    'lesson_review', 'structure_check', 'journey_test', 'publish'
  ));

-- These are defaults for the two not-yet-configured groups. Preserve any admin edits and skill scope.
INSERT INTO public.studio_catalog_scopes (
  group_kind, audience, corelia_direction, locale, research_period_days
) VALUES
  ('role', 'Người muốn theo một vai trò nghề nghiệp trong Web3 và cần lộ trình rõ kỹ năng',
   'Khóa theo vai trò, gom kỹ năng thành lộ trình làm việc được, ưu tiên thực hành', 'vi', 90),
  ('ecosystem', 'Lập trình viên muốn xây dựng trên một hệ sinh thái cụ thể như Solana hoặc Stellar',
   'Khóa nhập môn và thực hành trên một hệ sinh thái, dẫn tới ứng dụng đầu tiên chạy được', 'vi', 90)
ON CONFLICT (group_kind) DO NOTHING;

CREATE OR REPLACE FUNCTION private.studio_resume_run(p_run_id uuid, p_course_id uuid, p_from uuid)
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

  -- Step 0 has no run-owned generation. The new run is already pinned to the source job by
  -- studio_start_run; copy its done state alongside any accepted run-owned generations.
  IF v_from.catalog_job_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.studio_run_steps s
       JOIN public.studio_catalog_jobs j ON j.id = v_from.catalog_job_id
       WHERE s.run_id = p_from AND s.step_key = 'catalog_research' AND s.state = 'done'
         AND j.course_id = p_course_id AND j.status IN ('evidence_ok', 'needs_more_sources')
     )
     AND EXISTS (
       SELECT 1 FROM public.studio_runs r
       WHERE r.id = p_run_id AND r.catalog_job_id = v_from.catalog_job_id
     ) THEN
    v_steps := array_append(v_steps, 'catalog_research');
  END IF;

  -- The steps before the lessons, as far as they were done.
  FOREACH v_step IN ARRAY ARRAY['brief', 'research', 'curriculum', 'curriculum_review'] LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.studio_run_steps s WHERE s.run_id = p_from AND s.step_key = v_step AND s.state = 'done');
    SELECT g.id INTO v_gen FROM public.studio_generations g
    WHERE g.run_id = p_from AND g.step_key = v_step AND g.lesson_id IS NULL AND g.status = 'completed'
      AND coalesce(g.output ->> 'status', '') <> 'needs_research'
    ORDER BY g.attempt DESC LIMIT 1;
    EXIT WHEN v_gen IS NULL;
    v_ids := v_ids || v_gen;
    v_steps := v_steps || v_step;
  END LOOP;

  -- Lessons that were done: accepted drafts and their accepted reviews.
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

  -- Lessons whose newest accepted draft has no review yet: keep the draft, review still pending.
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

  IF cardinality(v_steps) = 0 AND cardinality(v_lessons) = 0 AND cardinality(v_unreviewed) = 0 THEN
    RETURN jsonb_build_object('skipped', 'nothing_done');
  END IF;

  PERFORM private.studio_copy_generations(p_run_id, v_ids || v_lessons || v_unreviewed);
  UPDATE public.studio_run_steps SET state = 'done' WHERE run_id = p_run_id AND step_key = ANY (v_steps);

  SELECT count(*)::integer INTO v_total
  FROM public.studio_generations c, jsonb_array_elements(c.output -> 'modules') m, jsonb_array_elements(m -> 'lessons') l
  WHERE c.run_id = p_run_id AND c.step_key = 'curriculum' AND c.lesson_id IS NULL;
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

REVOKE ALL ON FUNCTION private.studio_resume_run(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

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
  v_job_status text;
  v_period_days integer;
BEGIN
  -- Serializes starts with both this function and studio_start_catalog_job.
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
  IF EXISTS (
    SELECT 1
    FROM (SELECT DISTINCT p.group_kind FROM public.studio_course_paths cp
          JOIN public.studio_paths p ON p.id = cp.path_id WHERE cp.course_id = p_course_id) groups_for_course
    LEFT JOIN public.studio_catalog_scopes scope ON scope.group_kind = groups_for_course.group_kind
    WHERE scope.group_kind IS NULL
  ) THEN
    RAISE EXCEPTION 'scope_missing' USING ERRCODE = 'P0001';
  END IF;

  -- Resuming a completed step 0 keeps the exact profile used by that failed run, even if its TTL
  -- has since elapsed. It has no run-owned generation and will be copied by studio_resume_run.
  IF p_resume_from IS NOT NULL THEN
    SELECT j.id, j.status INTO v_catalog_job_id, v_job_status
    FROM public.studio_runs old_run
    JOIN public.studio_run_steps old_step
      ON old_step.run_id = old_run.id AND old_step.step_key = 'catalog_research' AND old_step.state = 'done'
    JOIN public.studio_catalog_jobs j
      ON j.id = old_run.catalog_job_id AND j.course_id = p_course_id
       AND j.status IN ('evidence_ok', 'needs_more_sources')
    WHERE old_run.id = p_resume_from AND old_run.course_id = p_course_id;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    -- One running job per course: attach it instead of causing the partial unique index to fail.
    SELECT j.id, j.status INTO v_catalog_job_id, v_job_status
    FROM public.studio_catalog_jobs j
    WHERE j.course_id = p_course_id AND j.status = 'running'
    ORDER BY j.started_at DESC, j.id DESC
    LIMIT 1;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    SELECT min(scope.research_period_days) INTO v_period_days
    FROM public.studio_course_paths cp
    JOIN public.studio_paths p ON p.id = cp.path_id
    JOIN public.studio_catalog_scopes scope ON scope.group_kind = p.group_kind
    WHERE cp.course_id = p_course_id;

    SELECT j.id, j.status INTO v_catalog_job_id, v_job_status
    FROM public.studio_catalog_jobs j
    WHERE j.course_id = p_course_id
      AND j.status IN ('evidence_ok', 'needs_more_sources')
      AND j.finished_at <= clock_timestamp()
      AND j.finished_at >= clock_timestamp() - make_interval(days => v_period_days)
    ORDER BY j.finished_at DESC, j.id DESC
    LIMIT 1;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    -- `manual` describes an explicit admin action; the existing trigger value avoids widening the
    -- database contract for a job initiated by the user's normal Start button.
    INSERT INTO public.studio_catalog_jobs (course_id, trigger, started_by)
    VALUES (p_course_id, 'manual', p_started_by)
    RETURNING id, status INTO v_catalog_job_id, v_job_status;
  END IF;

  INSERT INTO public.studio_runs (id, course_id, started_by, catalog_job_id)
  VALUES (p_run_id, p_course_id, p_started_by, v_catalog_job_id);
  INSERT INTO public.studio_run_steps (run_id, step_key, state)
  SELECT p_run_id, k,
         CASE WHEN k = 'catalog_research' AND v_job_status IN ('evidence_ok', 'needs_more_sources') THEN 'done' ELSE 'pending' END
  FROM unnest(ARRAY[
    'catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review', 'lessons',
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
