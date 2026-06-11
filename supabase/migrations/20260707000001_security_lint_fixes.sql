-- Security lint fixes
-- Addresses: function_search_path_mutable, anon_security_definer_function_executable,
-- authenticated_security_definer_function_executable

BEGIN;

-- ============================================================
-- 1. Fix mutable search_path on functions that lack SET search_path
-- ============================================================

-- Pure-expression helper: no table refs, safe to lock down to empty search_path
ALTER FUNCTION public.hackathon_score_document_has_valid_ranges(jsonb)
  SET search_path = '';

-- References public.knowledge_chunks and the pgvector <=> operator (in extensions schema)
ALTER FUNCTION public.match_knowledge_chunks(
  extensions.vector(1536),
  integer,
  text[],
  text,
  jsonb
)
  SET search_path = public, extensions;

-- Pure regex helper in private schema
ALTER FUNCTION private.is_uuid_text(text)
  SET search_path = '';

-- ============================================================
-- 2. Move hackathon_scores_validate_and_normalize to internal schema
--    It is a trigger-only function and must not be callable via REST RPC.
-- ============================================================

DROP TRIGGER IF EXISTS trg_hackathon_scores_validate_and_normalize
  ON public.hackathon_scores;

CREATE OR REPLACE FUNCTION internal.hackathon_scores_validate_and_normalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc jsonb := COALESCE(NEW.document, '{}'::jsonb);
  weights jsonb;
  product_score numeric;
  technical_score numeric;
  presentation_score numeric;
  impact_score numeric;
  product_weight numeric := 25;
  technical_weight numeric := 25;
  presentation_weight numeric := 25;
  impact_weight numeric := 25;
  total_weight numeric;
  total_score numeric;
BEGIN
  IF jsonb_typeof(doc) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_input:score_out_of_range';
  END IF;

  IF jsonb_typeof(doc->'product_score') IS DISTINCT FROM 'number'
    OR jsonb_typeof(doc->'technical_score') IS DISTINCT FROM 'number'
    OR jsonb_typeof(doc->'presentation_score') IS DISTINCT FROM 'number'
    OR jsonb_typeof(doc->'impact_score') IS DISTINCT FROM 'number'
  THEN
    RAISE EXCEPTION 'invalid_input:score_out_of_range';
  END IF;

  product_score := (doc->>'product_score')::numeric;
  technical_score := (doc->>'technical_score')::numeric;
  presentation_score := (doc->>'presentation_score')::numeric;
  impact_score := (doc->>'impact_score')::numeric;

  IF product_score IS NULL OR product_score < 0 OR product_score > 25
    OR technical_score IS NULL OR technical_score < 0 OR technical_score > 25
    OR presentation_score IS NULL OR presentation_score < 0 OR presentation_score > 25
    OR impact_score IS NULL OR impact_score < 0 OR impact_score > 25
  THEN
    RAISE EXCEPTION 'invalid_input:score_out_of_range';
  END IF;

  SELECT h.document->'rubric_weights'
    INTO weights
    FROM public.hackathons h
    WHERE h.id = NEW.hackathon_id;

  IF weights IS NOT NULL AND jsonb_typeof(weights) = 'object' THEN
    IF jsonb_typeof(weights->'product') = 'number' THEN
      product_weight := (weights->>'product')::numeric;
    END IF;
    IF jsonb_typeof(weights->'technical') = 'number' THEN
      technical_weight := (weights->>'technical')::numeric;
    END IF;
    IF jsonb_typeof(weights->'presentation') = 'number' THEN
      presentation_weight := (weights->>'presentation')::numeric;
    END IF;
    IF jsonb_typeof(weights->'impact') = 'number' THEN
      impact_weight := (weights->>'impact')::numeric;
    END IF;
  END IF;

  total_weight := product_weight + technical_weight + presentation_weight + impact_weight;
  IF product_weight < 0
    OR technical_weight < 0
    OR presentation_weight < 0
    OR impact_weight < 0
    OR total_weight <> 100
  THEN
    RAISE EXCEPTION 'invalid_input:rubric_weights_invalid';
  END IF;

  total_score := round(
    (product_score / 25) * product_weight
    + (technical_score / 25) * technical_weight
    + (presentation_score / 25) * presentation_weight
    + (impact_score / 25) * impact_weight,
    2
  );

  NEW.document := jsonb_set(doc, '{total_score}', to_jsonb(total_score), true);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION internal.hackathon_scores_validate_and_normalize() FROM PUBLIC;

-- Drop the old public-schema version (no longer exposed via REST)
DROP FUNCTION IF EXISTS public.hackathon_scores_validate_and_normalize();

CREATE TRIGGER trg_hackathon_scores_validate_and_normalize
  BEFORE INSERT OR UPDATE OF document, hackathon_id
  ON public.hackathon_scores
  FOR EACH ROW
  EXECUTE FUNCTION internal.hackathon_scores_validate_and_normalize();

-- ============================================================
-- 3. Drop public.sync_public_profile / public.delete_public_profile
--    These were migrated to internal schema; ensure they are gone.
-- ============================================================

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.sync_public_profile() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_public_profile_on_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_public_profile();

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.delete_public_profile() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END;
$$;
DROP TRIGGER IF EXISTS delete_public_profile_on_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.delete_public_profile();

-- ============================================================
-- 4. Revoke anon EXECUTE from authenticated-only RPC functions.
--    REVOKE FROM PUBLIC in prior migrations is not sufficient when
--    Supabase's default setup has granted EXECUTE to anon explicitly.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_id(uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_token(text)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_id(uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_token(text)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.peek_course_co_instructor_invite_by_token(text)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.revoke_course_co_instructor_invite(uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean)
  FROM anon;

COMMIT;
