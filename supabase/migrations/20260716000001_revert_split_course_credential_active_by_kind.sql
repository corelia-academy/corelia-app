-- Revert 20260716000000_split_course_credential_active_by_kind.sql.
-- The OCA/OCB independent-active split was rolled back at the product level —
-- a course keeps a single active course-scoped credential template (OCA or
-- OCB, not both) as before. Deactivate any extra active rows per course_id
-- first (defensive; none are expected since the split only shipped briefly)
-- so the restored single unique index can't fail on insert.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY course_id ORDER BY updated_at DESC, id DESC) AS rn
  FROM public.credential_templates
  WHERE scope_type = 'course' AND is_active = true
)
UPDATE public.credential_templates ct
SET is_active = false
FROM ranked
WHERE ct.id = ranked.id AND ranked.rn > 1;

DROP INDEX IF EXISTS public.credential_templates_unique_active_course_oca_idx;
DROP INDEX IF EXISTS public.credential_templates_unique_active_course_ocb_idx;

CREATE UNIQUE INDEX IF NOT EXISTS credential_templates_unique_active_course_idx
  ON public.credential_templates (course_id)
  WHERE scope_type = 'course' AND is_active = true;
