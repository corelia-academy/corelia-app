-- Start a Claude Code run for a course that already exists (an idea created in the
-- Studio UI, or a course whose previous run failed). Mirrors studio.start: the same
-- guards, resume and restart arguments, and the same single-running-run constraint.
-- Service-role only; the MCP endpoint verifies the caller's session and admin role.
CREATE FUNCTION public.studio_start_claude_run(
  p_run_id uuid,
  p_started_by uuid,
  p_course_id uuid,
  p_agent_models jsonb DEFAULT '{}'::jsonb,
  p_resume_from uuid DEFAULT NULL,
  p_restart_from text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_course uuid;
  v_existing_mode text;
  v_run_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_started_by AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL OR p_course_id IS NULL OR p_agent_models IS NULL OR jsonb_typeof(p_agent_models) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT r.course_id, r.execution_mode INTO v_existing_course, v_existing_mode
  FROM public.studio_runs r
  WHERE r.id = p_run_id;
  IF FOUND THEN
    IF v_existing_course <> p_course_id OR v_existing_mode <> 'claude_code' THEN
      RAISE EXCEPTION 'run_id_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('course_id', p_course_id, 'run_id', p_run_id, 'created', false);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_agent_models) AS model(key, value)
    WHERE model.key NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7')
      OR model.value NOT IN ('haiku', 'sonnet', 'opus', 'fable')
  ) THEN
    RAISE EXCEPTION 'invalid_agent_models' USING ERRCODE = '22023';
  END IF;

  v_run_result := public.studio_start_run(p_course_id, p_run_id, p_started_by, p_resume_from, p_restart_from);
  UPDATE public.studio_runs
  SET execution_mode = 'claude_code', agent_models = p_agent_models
  WHERE id = p_run_id;
  UPDATE public.studio_catalog_jobs
  SET execution_mode = 'claude_code', agent_models = p_agent_models
  WHERE id = (SELECT r.catalog_job_id FROM public.studio_runs r WHERE r.id = p_run_id);

  RETURN jsonb_build_object('course_id', p_course_id, 'run_id', p_run_id) || v_run_result;
END;
$$;

REVOKE ALL ON FUNCTION public.studio_start_claude_run(uuid, uuid, uuid, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_start_claude_run(uuid, uuid, uuid, jsonb, uuid, text) TO service_role;
