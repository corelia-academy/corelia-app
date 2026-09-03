BEGIN;

-- jobs-ai-1 accepted structurally valid model output on either a 0..1 ratio
-- or 0..100 percentage scale, while the quality gate consistently expects
-- 0..100. Normalize existing audit rows and canonical jobs before deploying
-- jobs-ai-2, which performs this conversion at the API boundary.
UPDATE public.job_classifications
SET
  quality_score = LEAST(100, quality_score * 100),
  output = jsonb_set(
    output,
    '{qualityScore}',
    to_jsonb(LEAST(100, quality_score * 100)),
    true
  )
WHERE classifier_version = 'jobs-ai-1'
  AND quality_score > 0
  AND quality_score <= 1;

UPDATE public.jobs
SET
  quality_score = LEAST(100, quality_score * 100),
  status = CASE
    WHEN status = 'rejected'
      AND review_reason = 'low_quality_or_confidence'
      AND NOT (manual_overrides ? 'status')
    THEN CASE
      WHEN classification_confidence >= 0.8
        AND quality_score * 100 >= 60
        AND primary_role IS NOT NULL
      THEN 'active'
      WHEN classification_confidence < 0.5 OR quality_score * 100 < 40
      THEN 'rejected'
      ELSE 'review'
    END
    ELSE status
  END,
  review_reason = CASE
    WHEN status = 'rejected'
      AND review_reason = 'low_quality_or_confidence'
      AND NOT (manual_overrides ? 'status')
    THEN CASE
      WHEN classification_confidence >= 0.8
        AND quality_score * 100 >= 60
        AND primary_role IS NOT NULL
      THEN NULL
      WHEN classification_confidence < 0.5 OR quality_score * 100 < 40
      THEN 'low_quality_or_confidence'
      ELSE 'needs_human_review'
    END
    ELSE review_reason
  END
WHERE classifier_version = 'jobs-ai-1'
  AND quality_score > 0
  AND quality_score <= 1;

UPDATE public.raw_jobs AS raw
SET
  processing_status = 'processed',
  processing_error = NULL,
  processed_at = now()
WHERE raw.processing_status = 'rejected'
  AND EXISTS (
    SELECT 1
    FROM public.jobs AS job
    WHERE job.id = raw.canonical_job_id
      AND job.classifier_version = 'jobs-ai-1'
      AND job.status IN ('active', 'review')
  );

COMMIT;
