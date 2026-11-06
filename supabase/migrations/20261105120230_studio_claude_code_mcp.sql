-- Keep Claude Code runs in the existing Studio dashboard while excluding them from
-- the server-side OpenAI schedulers. Model inference stays in the Claude Code client.
ALTER TABLE public.studio_runs
  ADD COLUMN execution_mode text NOT NULL DEFAULT 'server'
    CHECK (execution_mode IN ('server', 'claude_code')),
  ADD COLUMN agent_models jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(agent_models) = 'object');

ALTER TABLE public.studio_catalog_jobs
  ADD COLUMN execution_mode text NOT NULL DEFAULT 'server'
    CHECK (execution_mode IN ('server', 'claude_code')),
  ADD COLUMN agent_models jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(agent_models) = 'object');

-- Create the idea, attach its paths, start the normal Studio run, and pin the
-- external execution mode in one transaction. The RPC is service-role only;
-- the MCP endpoint separately verifies the caller's live Supabase session and
-- admin role before invoking it.
CREATE FUNCTION public.studio_start_claude_course(
  p_run_id uuid,
  p_started_by uuid,
  p_course jsonb,
  p_path_ids uuid[],
  p_agent_models jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_id uuid;
  v_title text;
  v_level text;
  v_audience text;
  v_direction text;
  v_locale text;
  v_research_period integer;
  v_unique_paths integer;
  v_run_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_started_by AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL OR jsonb_typeof(p_course) <> 'object' OR jsonb_typeof(p_agent_models) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.studio_runs r WHERE r.id = p_run_id) THEN
    SELECT r.course_id INTO v_course_id
    FROM public.studio_runs r
    WHERE r.id = p_run_id AND r.execution_mode = 'claude_code';
    IF v_course_id IS NULL THEN
      RAISE EXCEPTION 'run_id_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('course_id', v_course_id, 'run_id', p_run_id, 'created', false);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_agent_models) AS model(key, value)
    WHERE model.key NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7')
      OR model.value NOT IN ('haiku', 'sonnet', 'opus', 'fable')
  ) THEN
    RAISE EXCEPTION 'invalid_agent_models' USING ERRCODE = '22023';
  END IF;

  v_title := nullif(btrim(p_course ->> 'title'), '');
  v_level := nullif(p_course ->> 'level', '');
  v_audience := nullif(btrim(p_course ->> 'audience'), '');
  v_direction := nullif(btrim(p_course ->> 'corelia_direction'), '');
  v_locale := coalesce(nullif(p_course ->> 'content_locale', ''), 'vi');

  IF v_title IS NULL OR char_length(v_title) > 300
     OR v_audience IS NULL OR char_length(v_audience) > 1000
     OR v_direction IS NULL OR char_length(v_direction) > 1000
     OR (v_level IS NOT NULL AND v_level NOT IN ('beginner', 'intermediate', 'advanced'))
     OR v_locale NOT IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja')
     OR coalesce(p_course ->> 'research_period_days', '90') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'invalid_course_context' USING ERRCODE = '22023';
  END IF;

  v_research_period := coalesce((p_course ->> 'research_period_days')::integer, 90);
  IF v_research_period NOT BETWEEN 1 AND 3650 THEN
    RAISE EXCEPTION 'invalid_course_context' USING ERRCODE = '22023';
  END IF;
  IF coalesce(array_length(p_path_ids, 1), 0) = 0 OR array_position(p_path_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'course_has_no_path' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(DISTINCT paths.path_id) INTO v_unique_paths FROM unnest(p_path_ids) AS paths(path_id);
  IF v_unique_paths <> cardinality(p_path_ids) THEN
    RAISE EXCEPTION 'duplicate_path_ids' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.studio_courses (
    title, level, scope_note, audience, corelia_direction, content_locale, research_period_days
  ) VALUES (
    v_title,
    v_level,
    nullif(btrim(p_course ->> 'scope_note'), ''),
    v_audience,
    v_direction,
    v_locale,
    v_research_period
  ) RETURNING id INTO v_course_id;

  INSERT INTO public.studio_course_paths (course_id, path_id, learning_order, display_order)
  SELECT v_course_id, path_id, (ordinality - 1)::integer, (ordinality - 1)::integer
  FROM unnest(p_path_ids) WITH ORDINALITY AS paths(path_id, ordinality);

  v_run_result := public.studio_start_run(v_course_id, p_run_id, p_started_by, NULL, NULL);
  UPDATE public.studio_runs
  SET execution_mode = 'claude_code', agent_models = p_agent_models
  WHERE id = p_run_id;
  UPDATE public.studio_catalog_jobs
  SET execution_mode = 'claude_code', agent_models = p_agent_models
  WHERE id = (SELECT r.catalog_job_id FROM public.studio_runs r WHERE r.id = p_run_id);

  RETURN jsonb_build_object(
    'course_id', v_course_id,
    'run_id', p_run_id,
    'created', coalesce((v_run_result ->> 'created')::boolean, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_start_claude_course(uuid, uuid, jsonb, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_start_claude_course(uuid, uuid, jsonb, uuid[], jsonb) TO service_role;

CREATE FUNCTION public.studio_set_claude_agent_models(p_run_id uuid, p_agent_models jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_catalog_job_id uuid;
  v_status text;
BEGIN
  IF jsonb_typeof(p_agent_models) <> 'object' OR EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_agent_models) AS model(key, value)
    WHERE model.key NOT IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7')
      OR model.value NOT IN ('haiku', 'sonnet', 'opus', 'fable')
  ) THEN
    RAISE EXCEPTION 'invalid_agent_models' USING ERRCODE = '22023';
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
  IF EXISTS (
    SELECT 1 FROM public.studio_generations g
    WHERE g.run_id = p_run_id OR (v_catalog_job_id IS NOT NULL AND g.catalog_job_id = v_catalog_job_id)
  ) THEN
    RAISE EXCEPTION 'child_models_are_pinned_after_first_task' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_runs SET agent_models = p_agent_models WHERE id = p_run_id;
  IF v_catalog_job_id IS NOT NULL THEN
    UPDATE public.studio_catalog_jobs SET agent_models = p_agent_models WHERE id = v_catalog_job_id;
  END IF;
  RETURN jsonb_build_object('run_id', p_run_id, 'agent_models', p_agent_models, 'pinned', true);
END;
$$;

REVOKE ALL ON FUNCTION public.studio_set_claude_agent_models(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_set_claude_agent_models(uuid, jsonb) TO service_role;
