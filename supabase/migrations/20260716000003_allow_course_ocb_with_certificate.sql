-- OCB may coexist with a PDF completion certificate. When both are enabled,
-- the learner claims the OCB from the certificate card, using the same flow
-- as an OCA + certificate course.

DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_template ON public.credential_templates;
DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_course ON public.courses;
DROP FUNCTION IF EXISTS public.enforce_course_ocb_certificate_exclusion();
