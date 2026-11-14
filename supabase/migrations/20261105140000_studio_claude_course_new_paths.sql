-- A path belongs to a course: starting a Claude Code course may also create the
-- paths it needs (for example "Solana" under the ecosystem kind) in the same
-- transaction, instead of requiring them to exist beforehand. A path that already
-- exists for (group_kind, slug) is reused, so retries and shared paths are safe.
DROP FUNCTION public.studio_start_claude_course(uuid, uuid, jsonb, uuid[], jsonb);

CREATE FUNCTION public.studio_start_claude_course(
  p_run_id uuid,
  p_started_by uuid,
  p_course jsonb,
  p_path_ids uuid[],
  p_agent_models jsonb DEFAULT '{}'::jsonb,
  p_new_paths jsonb DEFAULT '[]'::jsonb
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
  v_new_path jsonb;
  v_kind text;
  v_slug text;
  v_path_title text;
  v_path_id uuid;
  v_path_ids uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_started_by AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL OR jsonb_typeof(p_course) <> 'object' OR jsonb_typeof(p_agent_models) <> 'object'
     OR p_new_paths IS NULL OR jsonb_typeof(p_new_paths) <> 'array' THEN
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

  IF p_path_ids IS NOT NULL AND array_position(p_path_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'course_has_no_path' USING ERRCODE = 'P0001';
  END IF;
  v_path_ids := coalesce(p_path_ids, ARRAY[]::uuid[]);

  -- Everything below runs in this transaction: a later failure also rolls back the paths created here.
  FOR v_new_path IN SELECT value FROM jsonb_array_elements(p_new_paths) LOOP
    IF jsonb_typeof(v_new_path) <> 'object' THEN
      RAISE EXCEPTION 'invalid_new_path' USING ERRCODE = '22023';
    END IF;
    v_kind := v_new_path ->> 'group_kind';
    v_slug := v_new_path ->> 'slug';
    v_path_title := nullif(btrim(v_new_path ->> 'title'), '');
    IF v_kind IS NULL OR v_kind NOT IN ('skill', 'role', 'ecosystem')
       OR v_slug IS NULL OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       OR v_path_title IS NULL OR char_length(v_path_title) > 200 THEN
      RAISE EXCEPTION 'invalid_new_path' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.studio_paths (group_kind, slug, title, display_order)
    VALUES (
      v_kind, v_slug, v_path_title,
      (SELECT coalesce(max(sp.display_order) + 1, 0) FROM public.studio_paths sp WHERE sp.group_kind = v_kind)
    )
    ON CONFLICT (group_kind, slug) DO NOTHING;

    SELECT sp.id INTO v_path_id
    FROM public.studio_paths sp
    WHERE sp.group_kind = v_kind AND sp.slug = v_slug;
    v_path_ids := v_path_ids || v_path_id;
  END LOOP;

  IF cardinality(v_path_ids) = 0 THEN
    RAISE EXCEPTION 'course_has_no_path' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(DISTINCT paths.path_id) INTO v_unique_paths FROM unnest(v_path_ids) AS paths(path_id);
  IF v_unique_paths <> cardinality(v_path_ids) THEN
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
  FROM unnest(v_path_ids) WITH ORDINALITY AS paths(path_id, ordinality);

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
    'path_ids', to_jsonb(v_path_ids),
    'created', coalesce((v_run_result ->> 'created')::boolean, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_start_claude_course(uuid, uuid, jsonb, uuid[], jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_start_claude_course(uuid, uuid, jsonb, uuid[], jsonb, jsonb) TO service_role;
