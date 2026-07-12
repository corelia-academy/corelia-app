-- Allow a course to have an active OCA (Certificate of Achievement) template
-- and an active OCB (Open Campus Badge) template at the same time.
-- Previously `credential_templates_unique_active_course_idx` allowed only one
-- active row per course_id regardless of kind, forcing the instructor UI to
-- treat OCA/OCB as mutually exclusive. Split the constraint per kind
-- (collection_symbol IS NULL = OCA, IS NOT NULL = OCB) so each kind can be
-- independently active.
DROP INDEX IF EXISTS public.credential_templates_unique_active_course_idx;

CREATE UNIQUE INDEX credential_templates_unique_active_course_oca_idx
  ON public.credential_templates (course_id)
  WHERE scope_type = 'course' AND is_active = true AND collection_symbol IS NULL;

CREATE UNIQUE INDEX credential_templates_unique_active_course_ocb_idx
  ON public.credential_templates (course_id)
  WHERE scope_type = 'course' AND is_active = true AND collection_symbol IS NOT NULL;
