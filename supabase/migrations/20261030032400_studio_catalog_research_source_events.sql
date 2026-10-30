-- Record the A1 result source in the same transaction that creates the run and its step 0 row.
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
  v_job_started_at timestamptz;
  v_job_finished_at timestamptz;
  v_period_days integer;
  v_period_group text;
  v_group_list text;
  v_source text;
  v_expires_at timestamptz;
  v_message text;
  v_now timestamptz;
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

  v_now := clock_timestamp();
  SELECT scope.research_period_days, p.group_kind
  INTO v_period_days, v_period_group
  FROM public.studio_course_paths cp
  JOIN public.studio_paths p ON p.id = cp.path_id
  JOIN public.studio_catalog_scopes scope ON scope.group_kind = p.group_kind
  WHERE cp.course_id = p_course_id
  ORDER BY scope.research_period_days,
           CASE p.group_kind WHEN 'skill' THEN 1 WHEN 'role' THEN 2 ELSE 3 END
  LIMIT 1;

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
    v_resume := private.studio_resume_run(p_run_id, p_course_id, p_resume_from);
  END IF;

  CASE v_source
    WHEN 'reused' THEN
      v_message := format(
        'Dùng lại kết quả nghiên cứu còn hiệu lực: job hoàn tất %s UTC (cách đây %s ngày), hiệu lực đến %s UTC (kỳ %s ngày của nhóm %s). Không gọi model.',
        to_char(v_job_finished_at AT TIME ZONE 'UTC', 'DD-MM-YYYY'),
        greatest(0, floor(extract(epoch FROM (v_now - v_job_finished_at)) / 86400))::integer,
        to_char(v_expires_at AT TIME ZONE 'UTC', 'DD-MM-YYYY'),
        v_period_days,
        v_period_group
      );
    WHEN 'kept_previous' THEN
      v_message := format(
        'Giữ nguyên kết quả nghiên cứu của lượt trước dù đã quá hạn ngày %s UTC, để brief và các bước đã đạt khớp nhau.',
        to_char(v_expires_at AT TIME ZONE 'UTC', 'DD-MM-YYYY')
      );
    WHEN 'attached_running' THEN
      v_message := format(
        'Gắn vào job nghiên cứu đang chạy, bắt đầu %s UTC.',
        to_char(v_job_started_at AT TIME ZONE 'UTC', 'DD-MM-YYYY HH24:MI')
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
      'finished_at', CASE WHEN v_job_finished_at IS NULL THEN NULL ELSE to_char(v_job_finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
      'expires_at', CASE WHEN v_expires_at IS NULL THEN NULL ELSE to_char(v_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
      'period_days', v_period_days,
      'period_group', v_period_group
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
