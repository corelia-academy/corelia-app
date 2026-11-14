-- Persist the user-selected Claude Code child-session effort alongside the
-- existing per-role model aliases. Defaults are supplied by the MCP endpoint.
ALTER TABLE public.studio_runs
  ADD COLUMN agent_efforts jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(agent_efforts) = 'object');

ALTER TABLE public.studio_catalog_jobs
  ADD COLUMN agent_efforts jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(agent_efforts) = 'object');

-- Update the active run profile. Partial maps preserve all unspecified roles,
-- and settings can be changed while the run is active so later tasks use them.
CREATE FUNCTION public.studio_set_claude_agent_preferences(
  p_run_id uuid,
  p_started_by uuid,
  p_agent_models jsonb DEFAULT '{}'::jsonb,
  p_agent_efforts jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_catalog_job_id uuid;
  v_status text;
  v_models jsonb;
  v_efforts jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_started_by AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL
     OR p_agent_models IS NULL OR jsonb_typeof(p_agent_models) <> 'object'
     OR p_agent_efforts IS NULL OR jsonb_typeof(p_agent_efforts) <> 'object'
     OR (p_agent_models = '{}'::jsonb AND p_agent_efforts = '{}'::jsonb) THEN
    RAISE EXCEPTION 'invalid_agent_preferences' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_agent_models) AS model(key, value)
    WHERE model.key NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7')
      OR model.value IS NULL
      OR model.value NOT IN ('haiku', 'sonnet', 'opus', 'fable')
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_agent_efforts) AS effort(key, value)
    WHERE effort.key NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7')
      OR effort.value IS NULL
      OR effort.value NOT IN ('low', 'medium', 'high', 'xhigh', 'max')
  ) THEN
    RAISE EXCEPTION 'invalid_agent_preferences' USING ERRCODE = '22023';
  END IF;

  SELECT r.catalog_job_id, r.status INTO v_catalog_job_id, v_status
  FROM public.studio_runs r
  WHERE r.id = p_run_id AND r.execution_mode = 'claude_code'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_claude_code_managed' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_runs
  SET agent_models = agent_models || p_agent_models,
      agent_efforts = agent_efforts || p_agent_efforts
  WHERE id = p_run_id
  RETURNING agent_models, agent_efforts INTO v_models, v_efforts;

  IF v_catalog_job_id IS NOT NULL THEN
    UPDATE public.studio_catalog_jobs
    SET agent_models = agent_models || p_agent_models,
        agent_efforts = agent_efforts || p_agent_efforts
    WHERE id = v_catalog_job_id;
  END IF;

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'agent_models', v_models,
    'agent_efforts', v_efforts,
    'pinned', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_set_claude_agent_preferences(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_set_claude_agent_preferences(uuid, uuid, jsonb, jsonb) TO service_role;
