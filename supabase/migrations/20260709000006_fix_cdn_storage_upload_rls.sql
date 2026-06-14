-- Fix CDN Storage update policies for app-side uploads.
--
-- The frontend writes permanent credential/branding assets to the public `cdn`
-- bucket. Keep the existing authorization model, but ensure UPDATE policies have
-- both USING and WITH CHECK so replacing an existing object is allowed only when
-- the final row still satisfies the same scoped permission.

DROP POLICY IF EXISTS cdn_course_badges_update ON storage.objects;
CREATE POLICY cdn_course_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'course'
    AND private.can_manage_corelia_course_ocb(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'course'
    AND private.can_manage_corelia_course_ocb(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

DROP POLICY IF EXISTS cdn_hackathon_badges_update ON storage.objects;
CREATE POLICY cdn_hackathon_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'hackathon'
    AND private.can_manage_hackathon(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'hackathon'
    AND private.can_manage_hackathon(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

DROP POLICY IF EXISTS cdn_milestone_badges_update ON storage.objects;
CREATE POLICY cdn_milestone_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'activity-milestone'
    AND public.is_admin_or_support()
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'activity-milestone'
    AND public.is_admin_or_support()
  );

DROP POLICY IF EXISTS cdn_brand_update ON storage.objects;
CREATE POLICY cdn_brand_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'brand'
    AND public.is_admin_or_support()
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'brand'
    AND public.is_admin_or_support()
  );

DROP POLICY IF EXISTS cdn_certificate_templates_update ON storage.objects;
CREATE POLICY cdn_certificate_templates_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course(
          (storage.foldername(name))[2],
          (SELECT auth.uid())
        )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course(
          (storage.foldername(name))[2],
          (SELECT auth.uid())
        )
  );
