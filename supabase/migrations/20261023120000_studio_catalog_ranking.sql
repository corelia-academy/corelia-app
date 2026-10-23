-- Corelia Studio: Catalog ranking pass (roadmap 3.1, stage 3).
--
--   * placement_for may also name the blocking prerequisite of a course left out as
--     blocked_by_prerequisite (placement_reason stays NULL there: the row is unranked).
--   * excluded_reason is one of the five codes the scoring step writes.
--   * studio_save_ranking writes one pass (the three group rankings and the production order, with
--     all their scores) in one transaction. PostgREST cannot span several statements, and a pass
--     must be readable as a whole or not at all.
--
--   * studio_catalog_rankings.source_as_of: the newest research result or manual order the pass was
--     computed from, read before its inputs. The scoring tick recomputes when that mark is newer than
--     the one of the latest production ranking; computed_at (the time of the save) cannot say it,
--     because a result can land between the read and the save.
--
-- Invariant for readers: the rankings of one pass share computed_at, the now() of the saving
-- transaction. "The pass" of a moment is the set of rankings with the production ranking's
-- computed_at; a group kind absent from that set was not part of the pass.

-- -----------------------------------------------------------------------------
-- 1) Constraints
-- -----------------------------------------------------------------------------

ALTER TABLE public.studio_catalog_scores
  DROP CONSTRAINT studio_catalog_scores_placement_for_iff_prerequisite;
-- COALESCE: with a NULL reason the comparison is NULL and a CHECK treats NULL as satisfied.
ALTER TABLE public.studio_catalog_scores
  ADD CONSTRAINT studio_catalog_scores_placement_for_iff_prerequisite
  CHECK ((placement_for IS NOT NULL) = (
    COALESCE(placement_reason = 'prerequisite_of', false)
    OR COALESCE(excluded_reason = 'blocked_by_prerequisite', false)));

ALTER TABLE public.studio_catalog_scores
  ADD CONSTRAINT studio_catalog_scores_excluded_reason_known
  CHECK (excluded_reason IS NULL OR excluded_reason IN (
    'not_researched', 'missing_core_criteria', 'no_path', 'prerequisite_cycle', 'blocked_by_prerequisite'));

ALTER TABLE public.studio_catalog_rankings ADD COLUMN source_as_of timestamptz;

-- -----------------------------------------------------------------------------
-- 2) Atomic save of a pass (service role only)
-- -----------------------------------------------------------------------------

-- p_source_as_of: the mark described above (NULL when nothing was researched yet).
-- p_rankings: [{"group_kind": "skill" | "role" | "ecosystem" | null, "scores": [{course_id, job_id,
-- components, total, confidence, rank, excluded_reason, placement_reason, placement_for}]}].
-- Exactly one element has group_kind null (the production order); the Types are not repeated.
-- Returns {computed_at, ranking_ids}. Every row is checked by the table constraints.
CREATE FUNCTION private.studio_save_ranking(p_weights_version integer, p_algorithm_version text, p_source_as_of timestamptz, p_rankings jsonb)
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
        <> jsonb_array_length(p_rankings) - 1 THEN
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
    FROM jsonb_to_recordset(COALESCE(v_element->'scores', '[]'::jsonb)) AS s (
      course_id uuid, job_id uuid, components jsonb, total numeric, confidence text,
      rank integer, excluded_reason text, placement_reason text, placement_for uuid);
  END LOOP;

  RETURN jsonb_build_object('computed_at', now(), 'ranking_ids', to_jsonb(v_ids));
END;
$$;

CREATE FUNCTION public.studio_save_ranking(p_weights_version integer, p_algorithm_version text, p_source_as_of timestamptz, p_rankings jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_save_ranking(p_weights_version, p_algorithm_version, p_source_as_of, p_rankings);
$$;

REVOKE ALL ON FUNCTION
  private.studio_save_ranking(integer, text, timestamptz, jsonb),
  public.studio_save_ranking(integer, text, timestamptz, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  private.studio_save_ranking(integer, text, timestamptz, jsonb),
  public.studio_save_ranking(integer, text, timestamptz, jsonb)
TO service_role;
