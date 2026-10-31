-- Corelia Studio - restart a failed run from the curriculum (or the research).
-- Resuming copies every accepted step, including a curriculum whose problem is only found while the
-- lessons are written (for example an outcome no lesson format can check). The lessons then fail the
-- same way on every retry, and the only way out was a full restart. p_restart_from names the first step
-- to regenerate: the steps before it are copied, it and everything after it (lessons included) are not.

DROP FUNCTION public.studio_start_run(uuid, uuid, uuid, uuid);
DROP FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid);
DROP FUNCTION private.studio_resume_run(uuid, uuid, uuid);

CREATE FUNCTION private.studio_resume_run(p_run_id uuid, p_course_id uuid, p_from uuid, p_restart_from text DEFAULT NULL)
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
  v_agent_role text;
  v_label text;
  v_message text;
  v_finished_at timestamptz;
BEGIN
  IF p_restart_from IS NOT NULL AND p_restart_from NOT IN ('research', 'curriculum') THEN
    RAISE EXCEPTION 'invalid_restart_step' USING ERRCODE = 'P0001';
  END IF;
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

  -- Catalog research has no run-owned generation; its one source event is written by studio_start_run.
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
    -- A restart keeps the steps before p_restart_from and regenerates it and everything after it.
    EXIT WHEN v_step = p_restart_from;
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

  -- Lessons were written for the curriculum being regenerated, so none of them is kept.
  IF p_restart_from IS NOT NULL THEN
    v_lessons := '{}';
    v_unreviewed := '{}';
  END IF;

  IF cardinality(v_steps) = 0 AND cardinality(v_lessons) = 0 AND cardinality(v_unreviewed) = 0 THEN
    RETURN jsonb_build_object('skipped', 'nothing_done');
  END IF;

  PERFORM private.studio_copy_generations(p_run_id, v_ids || v_lessons || v_unreviewed);
  UPDATE public.studio_run_steps SET state = 'done' WHERE run_id = p_run_id AND step_key = ANY (v_steps);
  v_done_lessons := cardinality(v_lessons) / 2;

  -- Every copied run-owned step gets one source line; Catalog keeps its start-run event only.
  FOREACH v_step IN ARRAY v_steps LOOP
    IF v_step = 'catalog_research' THEN CONTINUE; END IF;
    v_agent_role := CASE v_step
      WHEN 'brief' THEN 'A2'
      WHEN 'research' THEN 'A2'
      WHEN 'curriculum' THEN 'A3'
      WHEN 'curriculum_review' THEN 'A4'
    END;
    v_label := CASE v_step
      WHEN 'brief' THEN 'Chuẩn bị brief'
      WHEN 'research' THEN 'Nghiên cứu'
      WHEN 'curriculum' THEN 'Curriculum'
      WHEN 'curriculum_review' THEN 'Kiểm tra curriculum'
    END;
    SELECT coalesce(max(g.completed_at), v_from.finished_at) INTO v_finished_at
    FROM public.studio_generations g
    WHERE g.run_id = p_run_id AND g.step_key = v_step AND g.lesson_id IS NULL AND g.origin = 'resumed';
    IF v_finished_at IS NULL THEN RAISE EXCEPTION 'resume_copy_missing_finished_at:%', v_step; END IF;
    v_message := format('Dùng lại từ lượt trước: %s (lượt %s).', v_label, left(p_from::text, 8));
    INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload)
    VALUES (
      p_run_id, v_step, 0, 'result', v_agent_role, left(v_message, 500),
      jsonb_build_object(
        'source', 'resumed',
        'from_run_id', p_from,
        'step', v_step,
        'attempt', 0,
        'finished_at', to_char(v_finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )
    );
  END LOOP;

  IF cardinality(v_lessons) + cardinality(v_unreviewed) > 0 THEN
    SELECT coalesce(max(g.completed_at), v_from.finished_at) INTO v_finished_at
    FROM public.studio_generations g
    WHERE g.run_id = p_run_id AND g.step_key IN ('lessons', 'lesson_review') AND g.origin = 'resumed';
    IF v_finished_at IS NULL THEN RAISE EXCEPTION 'resume_copy_missing_finished_at:lessons'; END IF;
    v_message := format('Dùng lại từ lượt trước: %s lesson đã đạt, %s bản nháp chờ review.', v_done_lessons, cardinality(v_unreviewed));
    FOREACH v_step IN ARRAY ARRAY['lessons', 'lesson_review'] LOOP
      v_agent_role := CASE v_step WHEN 'lessons' THEN 'A5' ELSE 'A6' END;
      INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload)
      VALUES (
        p_run_id, v_step, 0, 'result', v_agent_role, left(v_message, 500),
        jsonb_build_object(
          'source', 'resumed',
          'from_run_id', p_from,
          'step', v_step,
          'attempt', 0,
          'finished_at', to_char(v_finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'completed_lessons', v_done_lessons,
          'pending_review_drafts', cardinality(v_unreviewed)
        )
      );
    END LOOP;
  END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.studio_generations c, jsonb_array_elements(c.output -> 'modules') m, jsonb_array_elements(m -> 'lessons') l
  WHERE c.run_id = p_run_id AND c.step_key = 'curriculum' AND c.lesson_id IS NULL;

  RETURN jsonb_build_object(
    'from_run_id', p_from,
    'steps', cardinality(v_steps),
    'lessons_copied', v_done_lessons,
    'drafts_copied', cardinality(v_unreviewed),
    'lessons_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION private.studio_resume_run(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.studio_start_run(
  p_course_id uuid,
  p_run_id uuid,
  p_started_by uuid,
  p_resume_from uuid DEFAULT NULL,
  p_restart_from text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_audience text;
  v_direction text;
  v_existing_course uuid;
  v_resume jsonb;
  v_catalog_job_id uuid;
  v_job_status text;
  v_job_started_at timestamptz;
  v_job_finished_at timestamptz;
  v_period_days integer;
  v_group_list text;
  v_source text;
  v_expires_at timestamptz;
  v_message text;
  v_now timestamptz;
  v_elapsed_days integer;
  v_remaining_days integer;
  v_overdue_days integer;
  v_elapsed_minutes integer;
BEGIN
  IF p_restart_from IS NOT NULL AND p_resume_from IS NULL THEN
    RAISE EXCEPTION 'restart_requires_resume' USING ERRCODE = 'P0001';
  END IF;
  -- Serializes starts with both this function and studio_start_catalog_job.
  SELECT c.status, c.audience, c.corelia_direction, c.research_period_days
  INTO v_status, v_audience, v_direction, v_period_days
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
  IF v_audience IS NULL OR v_direction IS NULL THEN
    RAISE EXCEPTION 'scope_missing' USING ERRCODE = 'P0001';
  END IF;

  v_now := clock_timestamp();
  SELECT string_agg(groups_for_course.group_kind, ', ' ORDER BY
           CASE groups_for_course.group_kind WHEN 'skill' THEN 1 WHEN 'role' THEN 2 ELSE 3 END)
  INTO v_group_list
  FROM (
    SELECT DISTINCT p.group_kind
    FROM public.studio_course_paths cp
    JOIN public.studio_paths p ON p.id = cp.path_id
    WHERE cp.course_id = p_course_id
  ) groups_for_course;

  -- Resuming a completed step 0 keeps its pinned job; an expired result remains usable for the
  -- copied brief so the resumed steps stay consistent with the accepted output.
  IF p_resume_from IS NOT NULL THEN
    SELECT j.id, j.status, j.started_at, j.finished_at
    INTO v_catalog_job_id, v_job_status, v_job_started_at, v_job_finished_at
    FROM public.studio_runs old_run
    JOIN public.studio_run_steps old_step
      ON old_step.run_id = old_run.id AND old_step.step_key = 'catalog_research' AND old_step.state = 'done'
    JOIN public.studio_catalog_jobs j
      ON j.id = old_run.catalog_job_id AND j.course_id = p_course_id
       AND j.status IN ('evidence_ok', 'needs_more_sources')
    WHERE old_run.id = p_resume_from AND old_run.course_id = p_course_id;
    IF FOUND THEN
      v_source := CASE
        WHEN v_job_finished_at >= v_now - make_interval(days => v_period_days) THEN 'reused'
        ELSE 'kept_previous'
      END;
    END IF;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    -- One running job per course: attach it instead of causing the partial unique index to fail.
    SELECT j.id, j.status, j.started_at, j.finished_at
    INTO v_catalog_job_id, v_job_status, v_job_started_at, v_job_finished_at
    FROM public.studio_catalog_jobs j
    WHERE j.course_id = p_course_id AND j.status = 'running'
    ORDER BY j.started_at DESC, j.id DESC
    LIMIT 1;
    IF FOUND THEN v_source := 'attached_running'; END IF;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    SELECT j.id, j.status, j.started_at, j.finished_at
    INTO v_catalog_job_id, v_job_status, v_job_started_at, v_job_finished_at
    FROM public.studio_catalog_jobs j
    WHERE j.course_id = p_course_id
      AND j.status IN ('evidence_ok', 'needs_more_sources')
      AND j.finished_at <= v_now
      AND j.finished_at >= v_now - make_interval(days => v_period_days)
    ORDER BY j.finished_at DESC, j.id DESC
    LIMIT 1;
    IF FOUND THEN v_source := 'reused'; END IF;
  END IF;

  IF v_catalog_job_id IS NULL THEN
    -- `manual` describes an explicit admin action; the existing trigger value avoids widening the
    -- database contract for a job initiated by the user's normal Start button.
    INSERT INTO public.studio_catalog_jobs (course_id, trigger, started_by)
    VALUES (p_course_id, 'manual', p_started_by)
    RETURNING id, status, started_at, finished_at
    INTO v_catalog_job_id, v_job_status, v_job_started_at, v_job_finished_at;
    v_source := 'started';
  END IF;

  v_expires_at := CASE
    WHEN v_job_finished_at IS NOT NULL THEN v_job_finished_at + make_interval(days => v_period_days)
    ELSE NULL
  END;

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
    v_resume := private.studio_resume_run(p_run_id, p_course_id, p_resume_from, p_restart_from);
  END IF;

  CASE v_source
    WHEN 'reused' THEN
      v_elapsed_days := greatest(0, floor(extract(epoch FROM (v_now - v_job_finished_at)) / 86400))::integer;
      v_remaining_days := greatest(0, ceil(extract(epoch FROM (v_expires_at - v_now)) / 86400))::integer;
      v_message := format(
        'Dùng lại kết quả nghiên cứu còn hiệu lực: job hoàn tất cách đây %s ngày, còn hiệu lực %s ngày (kỳ %s ngày của khóa). Không gọi model.',
        v_elapsed_days,
        v_remaining_days,
        v_period_days
      );
    WHEN 'kept_previous' THEN
      v_overdue_days := greatest(0, floor(extract(epoch FROM (v_now - v_expires_at)) / 86400))::integer;
      v_message := format(
        'Giữ nguyên kết quả nghiên cứu của lượt trước dù đã quá hạn %s ngày, để brief và các bước đã đạt khớp nhau.',
        v_overdue_days
      );
    WHEN 'attached_running' THEN
      v_elapsed_minutes := greatest(0, floor(extract(epoch FROM (v_now - v_job_started_at)) / 60))::integer;
      v_message := format(
        'Gắn vào job nghiên cứu đang chạy, đã chạy %s phút.',
        v_elapsed_minutes
      );
    ELSE
      v_message := format('Bắt đầu nghiên cứu mới cho nhóm: %s.', v_group_list);
  END CASE;

  INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload)
  VALUES (
    p_run_id,
    'catalog_research',
    0,
    'progress',
    'A1',
    left(v_message, 500),
    jsonb_build_object(
      'source', v_source,
      'job_id', v_catalog_job_id,
      'started_at', to_char(v_job_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'finished_at', CASE WHEN v_job_finished_at IS NULL THEN NULL ELSE to_char(v_job_finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
      'expires_at', CASE WHEN v_expires_at IS NULL THEN NULL ELSE to_char(v_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
      'period_days', v_period_days
    )
  );

  RETURN jsonb_build_object('run_id', p_run_id, 'created', true)
    || CASE
      WHEN v_resume IS NULL THEN '{}'::jsonb
      WHEN v_resume ? 'skipped' THEN jsonb_build_object('resume_skipped', v_resume -> 'skipped')
      ELSE jsonb_build_object('resume', v_resume)
    END;
END;
$$;

CREATE FUNCTION public.studio_start_run(
  p_course_id uuid,
  p_run_id uuid,
  p_started_by uuid,
  p_resume_from uuid DEFAULT NULL,
  p_restart_from text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_start_run(p_course_id, p_run_id, p_started_by, p_resume_from, p_restart_from);
$$;

REVOKE ALL ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_start_run(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.studio_start_run(uuid, uuid, uuid, uuid, text), public.studio_start_run(uuid, uuid, uuid, uuid, text) TO service_role;
