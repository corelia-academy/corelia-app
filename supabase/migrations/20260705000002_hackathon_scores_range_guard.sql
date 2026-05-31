BEGIN;

CREATE OR REPLACE FUNCTION public.hackathon_score_document_has_valid_ranges(doc jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    jsonb_typeof(doc) = 'object'
    AND jsonb_typeof(doc->'product_score') = 'number'
    AND jsonb_typeof(doc->'technical_score') = 'number'
    AND jsonb_typeof(doc->'presentation_score') = 'number'
    AND jsonb_typeof(doc->'impact_score') = 'number'
    AND (doc->>'product_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'technical_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'presentation_score')::numeric BETWEEN 0 AND 25
    AND (doc->>'impact_score')::numeric BETWEEN 0 AND 25;
$$;

ALTER TABLE public.hackathon_scores
  DROP CONSTRAINT IF EXISTS hackathon_scores_document_score_ranges;

ALTER TABLE public.hackathon_scores
  ADD CONSTRAINT hackathon_scores_document_score_ranges
  CHECK (public.hackathon_score_document_has_valid_ranges(document))
  NOT VALID;

COMMIT;
