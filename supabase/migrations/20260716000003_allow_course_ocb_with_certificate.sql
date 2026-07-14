-- OCB may coexist with a PDF completion certificate. OCB remains auto-issued
-- when the learner completes the course; both cards link to that same OCB.

DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_template ON public.credential_templates;
DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_course ON public.courses;
DROP FUNCTION IF EXISTS public.enforce_course_ocb_certificate_exclusion();
