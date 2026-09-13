-- Course Open Campus credentials are centrally managed. Keep learner reads and
-- issuance behavior unchanged while limiting every configuration write to an
-- administrator of a Corelia-owned course.

CREATE OR REPLACE FUNCTION private.can_manage_corelia_course_ocb(
  p_course_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    JOIN public.profiles p ON p.id = p_user_id
    WHERE c.id = p_course_id
      AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
      AND p.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS credential_templates_insert ON public.credential_templates;
CREATE POLICY credential_templates_insert
  ON public.credential_templates FOR INSERT TO authenticated
  WITH CHECK (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND private.can_manage_corelia_course_ocb(course_id, (SELECT auth.uid()))
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

DROP POLICY IF EXISTS credential_templates_update ON public.credential_templates;
CREATE POLICY credential_templates_update
  ON public.credential_templates FOR UPDATE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND private.can_manage_corelia_course_ocb(course_id, (SELECT auth.uid()))
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  )
  WITH CHECK (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND private.can_manage_corelia_course_ocb(course_id, (SELECT auth.uid()))
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

DROP POLICY IF EXISTS credential_templates_delete ON public.credential_templates;
CREATE POLICY credential_templates_delete
  ON public.credential_templates FOR DELETE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND private.can_manage_corelia_course_ocb(course_id, (SELECT auth.uid()))
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

-- OCA artwork shares the certificate template directory. Preserve instructor
-- access to ordinary certificate templates and reserve the `-onchain` variant
-- for course credential administrators.
DROP POLICY IF EXISTS cdn_certificate_templates_insert ON storage.objects;
CREATE POLICY cdn_certificate_templates_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS cdn_certificate_templates_update ON storage.objects;
CREATE POLICY cdn_certificate_templates_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS cdn_certificate_templates_delete ON storage.objects;
CREATE POLICY cdn_certificate_templates_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

-- Apply the same split to historical objects in the private app bucket.
DROP POLICY IF EXISTS storage_certificate_templates_manage ON storage.objects;
CREATE POLICY storage_certificate_templates_manage
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course_feature(
          (storage.foldername(name))[2], (SELECT auth.uid()), 'certificates'
        )
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS storage_certificate_templates_manage_update ON storage.objects;
CREATE POLICY storage_certificate_templates_manage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course_feature(
          (storage.foldername(name))[2], (SELECT auth.uid()), 'certificates'
        )
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course_feature(
          (storage.foldername(name))[2], (SELECT auth.uid()), 'certificates'
        )
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS storage_certificate_templates_manage_delete ON storage.objects;
CREATE POLICY storage_certificate_templates_manage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND (
      (
        storage.filename(name) NOT LIKE '%-onchain.%'
        AND private.can_manage_course_feature(
          (storage.foldername(name))[2], (SELECT auth.uid()), 'certificates'
        )
      )
      OR (
        storage.filename(name) LIKE '%-onchain.%'
        AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
      )
    )
  );

CREATE OR REPLACE FUNCTION private.guard_course_onchain_credential_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  changes_onchain_fields boolean;
BEGIN
  changes_onchain_fields := CASE
    WHEN TG_OP = 'INSERT' THEN
      NEW.data ?| ARRAY[
        'onchain_certificate_template_url',
        'onchain_certificate_template_path'
      ]
    ELSE
      NEW.data->'onchain_certificate_template_url'
        IS DISTINCT FROM OLD.data->'onchain_certificate_template_url'
      OR NEW.data->'onchain_certificate_template_path'
        IS DISTINCT FROM OLD.data->'onchain_certificate_template_path'
  END;

  IF changes_onchain_fields
    AND auth.uid() IS NOT NULL
    AND COALESCE(public.current_profile_role(), '') <> 'admin'
  THEN
    RAISE EXCEPTION 'COURSE_CREDENTIAL_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_course_onchain_credential_fields()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_course_onchain_credential_fields ON public.courses;
CREATE TRIGGER guard_course_onchain_credential_fields
  BEFORE INSERT OR UPDATE OF data ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_course_onchain_credential_fields();
