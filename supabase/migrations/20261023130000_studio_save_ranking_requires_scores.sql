-- studio_save_ranking: every ranking of a pass must carry its score list under "scores" (an array,
-- empty only when sent as []). A missing or mistyped key used to be read as an empty list, so a payload
-- with another key name was saved as rankings without rows. Same signature and privileges as
-- 20261023120000 (CREATE OR REPLACE keeps the grants).

CREATE OR REPLACE FUNCTION private.studio_save_ranking(p_weights_version integer, p_algorithm_version text, p_source_as_of timestamptz, p_rankings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_element jsonb;
  v_ranking_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  -- Nested, so the array functions below never see a non-array.
  IF p_rankings IS NULL OR jsonb_typeof(p_rankings) <> 'array' THEN
    RAISE EXCEPTION 'invalid_ranking_pass' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_rankings) = 0
     OR (SELECT count(*) FROM jsonb_array_elements(p_rankings) AS e (v) WHERE e.v->>'group_kind' IS NULL) <> 1
     OR (SELECT count(DISTINCT e.v->>'group_kind') FROM jsonb_array_elements(p_rankings) AS e (v) WHERE e.v->>'group_kind' IS NOT NULL)
        <> jsonb_array_length(p_rankings) - 1
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_rankings) AS e (v) WHERE jsonb_typeof(e.v) IS DISTINCT FROM 'object' OR jsonb_typeof(e.v->'scores') IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'invalid_ranking_pass' USING ERRCODE = 'P0001';
  END IF;

  FOR v_element IN SELECT e.v FROM jsonb_array_elements(p_rankings) AS e (v) LOOP
    INSERT INTO public.studio_catalog_rankings (group_kind, weights_version, algorithm_version, source_as_of)
    VALUES (v_element->>'group_kind', p_weights_version, p_algorithm_version, p_source_as_of)
    RETURNING id INTO v_ranking_id;
    v_ids := v_ids || v_ranking_id;

    INSERT INTO public.studio_catalog_scores
      (ranking_id, course_id, job_id, components, total, confidence, rank, excluded_reason, placement_reason, placement_for)
    SELECT v_ranking_id, s.course_id, s.job_id, COALESCE(s.components, '{}'::jsonb), s.total, s.confidence,
           s.rank, s.excluded_reason, s.placement_reason, s.placement_for
    FROM jsonb_to_recordset(v_element->'scores') AS s (
      course_id uuid, job_id uuid, components jsonb, total numeric, confidence text,
      rank integer, excluded_reason text, placement_reason text, placement_for uuid);
  END LOOP;

  RETURN jsonb_build_object('computed_at', now(), 'ranking_ids', to_jsonb(v_ids));
END;
$$;
