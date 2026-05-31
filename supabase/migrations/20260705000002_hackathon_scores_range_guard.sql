BEGIN;

CREATE OR REPLACE FUNCTION public.hackathon_score_document_has_valid_ranges(doc jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_typeof(doc) = 'object'
    AND jsonb_typeof(doc->'product_score') = 'number'
    AND jsonb_typeof(doc->'technical_score') = 'number'
    AND jsonb_typeof(doc->'presentation_score') = 'number'
    AND jsonb_typeof(doc->'impact_score') = 'number'
    AND jsonb_typeof(doc->'total_score') = 'number'
    AND (doc->>'product_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'technical_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'presentation_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'impact_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'total_score')::numeric BETWEEN 0 AND 100,
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.hackathon_scores_validate_and_normalize()
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

DROP TRIGGER IF EXISTS trg_hackathon_scores_validate_and_normalize
  ON public.hackathon_scores;

CREATE TRIGGER trg_hackathon_scores_validate_and_normalize
  BEFORE INSERT OR UPDATE OF document, hackathon_id
  ON public.hackathon_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.hackathon_scores_validate_and_normalize();

ALTER TABLE public.hackathon_scores
  DROP CONSTRAINT IF EXISTS hackathon_scores_document_score_ranges;

ALTER TABLE public.hackathon_scores
  ADD CONSTRAINT hackathon_scores_document_score_ranges
  CHECK (public.hackathon_score_document_has_valid_ranges(document))
  NOT VALID;

COMMIT;
