-- Corelia Studio - resuming a run keeps the translations it already accepted.
-- A resume copied the lessons but not the translations, so one lesson failing in one language
-- paid for every language of every lesson again.

CREATE OR REPLACE FUNCTION private.studio_copy_generations(p_run_id uuid, p_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH copied AS (
    INSERT INTO public.studio_generations (
      run_id, step_key, lesson_id, locale, attempt, agent_role, kind, origin, provider, requested_model_id, model_id,
      prompt_version, params, input, parent_generation_id, status, provider_request_id, output, usage,
      created_at, submitted_at, completed_at
    )
    SELECT p_run_id, g.step_key, g.lesson_id, g.locale, 0, g.agent_role, g.kind, 'resumed', g.provider, g.requested_model_id, g.model_id,
           g.prompt_version, g.params, g.input, g.id, 'completed', 'resume:' || g.id::text, g.output, g.usage,
           g.created_at, g.submitted_at, g.completed_at
    FROM public.studio_generations g
    WHERE g.id = ANY (p_ids)
    RETURNING 1
  )
  SELECT count(*)::integer FROM copied;
$function$;

CREATE OR REPLACE FUNCTION private.studio_resume_run(p_run_id uuid, p_course_id uuid, p_from uuid, p_restart_from text DEFAULT NULL)
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
  v_translations uuid[];
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

  -- Translation starts only after every lesson passed, so the translations of the failed run belong to the lessons copied above.
  SELECT coalesce(array_agg(g.id), '{}') INTO v_translations
  FROM public.studio_generations g
  WHERE g.run_id = p_from AND g.step_key = 'translate' AND g.status = 'completed' AND g.locale IS NOT NULL
    AND p_restart_from IS NULL;

  IF cardinality(v_steps) = 0 AND cardinality(v_lessons) = 0 AND cardinality(v_unreviewed) = 0 THEN
    RETURN jsonb_build_object('skipped', 'nothing_done');
  END IF;

  PERFORM private.studio_copy_generations(p_run_id, v_ids || v_lessons || v_unreviewed || v_translations);
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

  IF cardinality(v_translations) > 0 THEN
    SELECT coalesce(max(g.completed_at), v_from.finished_at) INTO v_finished_at
    FROM public.studio_generations g
    WHERE g.run_id = p_run_id AND g.step_key = 'translate' AND g.origin = 'resumed';
    IF v_finished_at IS NULL THEN RAISE EXCEPTION 'resume_copy_missing_finished_at:translate'; END IF;
    v_message := format('Dùng lại từ lượt trước: %s bản dịch đã đạt.', cardinality(v_translations));
    INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, agent_role, message, payload)
    VALUES (
      p_run_id, 'translate', 0, 'result', 'A7', left(v_message, 500),
      jsonb_build_object(
        'source', 'resumed',
        'from_run_id', p_from,
        'step', 'translate',
        'attempt', 0,
        'finished_at', to_char(v_finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'translations_copied', cardinality(v_translations)
      )
    );
  END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.studio_generations c, jsonb_array_elements(c.output -> 'modules') m, jsonb_array_elements(m -> 'lessons') l
  WHERE c.run_id = p_run_id AND c.step_key = 'curriculum' AND c.lesson_id IS NULL;

  RETURN jsonb_build_object(
    'from_run_id', p_from,
    'steps', cardinality(v_steps),
    'lessons_copied', v_done_lessons,
    'drafts_copied', cardinality(v_unreviewed),
    'translations_copied', cardinality(v_translations),
    'lessons_total', v_total
  );
END;
$$;
