-- Pause and continue a running Studio run without changing its status or the one-running-run guard.

ALTER TABLE public.studio_runs
  ADD COLUMN paused_at timestamptz;

ALTER TABLE public.studio_runs
  ADD CONSTRAINT studio_runs_paused_only_while_running
  CHECK (paused_at IS NULL OR status = 'running');

CREATE OR REPLACE FUNCTION private.studio_pause_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_paused_at timestamptz;
  v_now timestamptz;
  v_step text;
BEGIN
  SELECT r.status, r.paused_at
    INTO v_status, v_paused_at
  FROM public.studio_runs r
  WHERE r.id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = 'P0001';
  END IF;
  IF v_paused_at IS NOT NULL THEN
    RETURN jsonb_build_object('run_id', p_run_id, 'changed', false, 'paused_at', v_paused_at);
  END IF;

  v_now := clock_timestamp();
  UPDATE public.studio_runs SET paused_at = v_now WHERE id = p_run_id;

  SELECT s.step_key INTO v_step
  FROM public.studio_run_steps s
  WHERE s.run_id = p_run_id AND s.state <> 'done'
  ORDER BY array_position(ARRAY[
    'catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review',
    'lessons', 'lesson_review', 'structure_check', 'journey_test', 'publish'
  ]::text[], s.step_key)
  LIMIT 1;
  v_step := coalesce(v_step, 'publish');

  INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, message, payload)
  VALUES (
    p_run_id,
    v_step,
    0,
    'progress',
    'Tạm dừng lượt chạy; có hiệu lực từ lần tick kế tiếp.',
    jsonb_build_object('paused_at', v_now)
  );

  RETURN jsonb_build_object('run_id', p_run_id, 'changed', true, 'paused_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION private.studio_continue_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_paused_at timestamptz;
  v_now timestamptz;
  v_paused_seconds bigint;
  v_step text;
BEGIN
  SELECT r.status, r.paused_at
    INTO v_status, v_paused_at
  FROM public.studio_runs r
  WHERE r.id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = 'P0001';
  END IF;
  IF v_paused_at IS NULL THEN
    RETURN jsonb_build_object('run_id', p_run_id, 'changed', false, 'paused_at', NULL);
  END IF;

  v_now := clock_timestamp();
  v_paused_seconds := greatest(0::numeric, floor(extract(epoch FROM (v_now - v_paused_at))))::bigint;
  UPDATE public.studio_runs SET paused_at = NULL WHERE id = p_run_id;

  SELECT s.step_key INTO v_step
  FROM public.studio_run_steps s
  WHERE s.run_id = p_run_id AND s.state <> 'done'
  ORDER BY array_position(ARRAY[
    'catalog_research', 'brief', 'research', 'curriculum', 'curriculum_review',
    'lessons', 'lesson_review', 'structure_check', 'journey_test', 'publish'
  ]::text[], s.step_key)
  LIMIT 1;
  v_step := coalesce(v_step, 'publish');

  INSERT INTO public.studio_run_events (run_id, step_key, attempt, kind, message, payload)
  VALUES (
    p_run_id,
    v_step,
    0,
    'progress',
    format('Tiếp tục lượt chạy sau %s giây tạm dừng.', v_paused_seconds),
    jsonb_build_object('resumed_at', v_now, 'paused_seconds', v_paused_seconds)
  );

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'changed', true,
    'paused_at', NULL,
    'resumed_at', v_now,
    'paused_seconds', v_paused_seconds
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.studio_pause_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_pause_run(p_run_id);
$$;

CREATE OR REPLACE FUNCTION public.studio_continue_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_continue_run(p_run_id);
$$;

-- A terminal run must never retain the paused marker.
CREATE OR REPLACE FUNCTION private.studio_finish_run(p_run_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course uuid;
BEGIN
  IF p_status NOT IN ('published', 'draft_failed') THEN
    RAISE EXCEPTION 'invalid_run_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_runs
  SET status = p_status,
      finished_at = now(),
      hold_reason = CASE WHEN p_status = 'draft_failed' THEN left(p_reason, 1000) END,
      paused_at = NULL
  WHERE id = p_run_id AND status = 'running'
  RETURNING course_id INTO v_course;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.studio_run_steps
  SET state = CASE WHEN p_status = 'published' THEN 'done' ELSE 'pending' END
  WHERE run_id = p_run_id AND state = 'active';

  UPDATE public.studio_courses
  SET status = CASE WHEN p_status = 'published' THEN 'published' ELSE 'not_passed' END
  WHERE id = v_course;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.studio_pause_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.studio_continue_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_pause_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_continue_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION
  private.studio_pause_run(uuid),
  private.studio_continue_run(uuid),
  public.studio_pause_run(uuid),
  public.studio_continue_run(uuid)
TO service_role;
