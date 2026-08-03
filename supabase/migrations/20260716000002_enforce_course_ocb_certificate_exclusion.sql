-- A course may have either an active OCB or a PDF completion certificate, not
-- both. Enforce the product invariant in the database because the course form
-- and credential form persist independently and can otherwise race.

CREATE OR REPLACE FUNCTION public.enforce_course_ocb_certificate_exclusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_has_certificate boolean;
BEGIN
  IF TG_TABLE_NAME = 'credential_templates' THEN
    IF NEW.scope_type = 'course'
      AND NEW.course_id IS NOT NULL
      AND NEW.is_active = true
      AND NEW.collection_symbol IS NOT NULL THEN
      -- The course and template are written by separate requests. Serialize
      -- them by course id so two concurrent transactions cannot both observe
      -- the old, non-conflicting state and commit an invalid combination.
      PERFORM pg_advisory_xact_lock(hashtext(NEW.course_id::text));

      SELECT
        COALESCE((c.data->>'has_certificate')::boolean, false)
        OR NULLIF(btrim(COALESCE(c.data->>'certificate_template_url', '')), '') IS NOT NULL
      INTO v_course_has_certificate
      FROM public.courses AS c
      WHERE c.id = NEW.course_id;

      IF COALESCE(v_course_has_certificate, false) THEN
        RAISE EXCEPTION 'OCB cannot be active while this course issues a PDF certificate.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    -- Must use the same per-course transaction lock as the template branch.
    PERFORM pg_advisory_xact_lock(hashtext(NEW.id::text));

    v_course_has_certificate :=
      COALESCE((NEW.data->>'has_certificate')::boolean, false)
      OR NULLIF(btrim(COALESCE(NEW.data->>'certificate_template_url', '')), '') IS NOT NULL;

    IF v_course_has_certificate
      AND NOT (
        COALESCE((OLD.data->>'has_certificate')::boolean, false)
        OR NULLIF(btrim(COALESCE(OLD.data->>'certificate_template_url', '')), '') IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM public.credential_templates AS ct
        WHERE ct.scope_type = 'course'
          AND ct.course_id = NEW.id
          AND ct.is_active = true
          AND ct.collection_symbol IS NOT NULL
      ) THEN
      RAISE EXCEPTION 'A PDF certificate cannot be enabled while this course has an active OCB.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_template ON public.credential_templates;
CREATE TRIGGER enforce_course_ocb_certificate_on_template
  BEFORE INSERT OR UPDATE OF scope_type, course_id, is_active, collection_symbol
  ON public.credential_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_course_ocb_certificate_exclusion();

DROP TRIGGER IF EXISTS enforce_course_ocb_certificate_on_course ON public.courses;
CREATE TRIGGER enforce_course_ocb_certificate_on_course
  BEFORE UPDATE OF data
  ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_course_ocb_certificate_exclusion();
