-- Tighten storage access for course, credential, and partner document assets.

DROP POLICY IF EXISTS storage_course_thumbnails_write ON storage.objects;
DROP POLICY IF EXISTS storage_course_thumbnails_update ON storage.objects;
DROP POLICY IF EXISTS storage_course_thumbnails_delete ON storage.objects;

CREATE POLICY storage_course_thumbnails_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_thumbnails_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_thumbnails_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS storage_course_assets_read ON storage.objects;
CREATE POLICY storage_course_assets_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos',
      'course-partners',
      'course-partner-brand',
      'course-credential-badges',
      'hackathon-credential-badges',
      'activity-milestone-badges',
      'contest-org-partner-logos'
    )
  );

DROP POLICY IF EXISTS storage_course_assets_write ON storage.objects;

CREATE POLICY storage_course_assets_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos',
      'course-partners',
      'course-partner-brand',
      'course-partner-docs'
    )
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_assets_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos',
      'course-partners',
      'course-partner-brand',
      'course-partner-docs'
    )
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos',
      'course-partners',
      'course-partner-brand',
      'course-partner-docs'
    )
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_assets_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos',
      'course-partners',
      'course-partner-brand',
      'course-partner-docs'
    )
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_certificate_templates_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course_feature(
      (storage.foldername(name))[2],
      (SELECT auth.uid()),
      'certificates'
    )
  );

CREATE POLICY storage_certificate_templates_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course_feature(
      (storage.foldername(name))[2],
      (SELECT auth.uid()),
      'certificates'
    )
  );

CREATE POLICY storage_certificate_templates_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course_feature(
      (storage.foldername(name))[2],
      (SELECT auth.uid()),
      'certificates'
    )
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course_feature(
      (storage.foldername(name))[2],
      (SELECT auth.uid()),
      'certificates'
    )
  );

CREATE POLICY storage_certificate_templates_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course_feature(
      (storage.foldername(name))[2],
      (SELECT auth.uid()),
      'certificates'
    )
  );

CREATE POLICY storage_course_ocb_badges_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-credential-badges'
    AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_ocb_badges_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-credential-badges'
    AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-credential-badges'
    AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_ocb_badges_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-credential-badges'
    AND private.can_manage_corelia_course_ocb((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_hackathon_badges_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'hackathon-credential-badges'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_hackathon_badges_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'hackathon-credential-badges'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'hackathon-credential-badges'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_hackathon_badges_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'hackathon-credential-badges'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_activity_milestone_badges_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'activity-milestone-badges'
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_activity_milestone_badges_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'activity-milestone-badges'
    AND public.is_admin_or_support()
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'activity-milestone-badges'
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_activity_milestone_badges_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'activity-milestone-badges'
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_contest_org_partner_logos_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_contest_org_partner_logos_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_contest_org_partner_logos_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS storage_final_submissions ON storage.objects;

CREATE POLICY storage_final_submissions_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
    AND (
      (storage.foldername(name))[3] = ((SELECT auth.uid())::text)
      OR private.can_manage_course_feature(
        (storage.foldername(name))[2],
        (SELECT auth.uid()),
        'submissions'
      )
    )
  );

CREATE POLICY storage_final_submissions_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
    AND (storage.foldername(name))[3] = ((SELECT auth.uid())::text)
  );

CREATE POLICY storage_final_submissions_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
    AND (
      (storage.foldername(name))[3] = ((SELECT auth.uid())::text)
      OR private.can_manage_course_feature(
        (storage.foldername(name))[2],
        (SELECT auth.uid()),
        'submissions'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
    AND (
      (storage.foldername(name))[3] = ((SELECT auth.uid())::text)
      OR private.can_manage_course_feature(
        (storage.foldername(name))[2],
        (SELECT auth.uid()),
        'submissions'
      )
    )
  );

CREATE POLICY storage_final_submissions_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
    AND (
      (storage.foldername(name))[3] = ((SELECT auth.uid())::text)
      OR private.can_manage_course_feature(
        (storage.foldername(name))[2],
        (SELECT auth.uid()),
        'submissions'
      )
    )
  );

DROP POLICY IF EXISTS storage_instructor_partner_docs ON storage.objects;

CREATE POLICY storage_instructor_partner_docs_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
    AND (
      public.is_admin_or_support()
      OR (storage.foldername(name))[2] = ((SELECT auth.uid())::text)
    )
  );

CREATE POLICY storage_instructor_partner_docs_manage
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_instructor_partner_docs_manage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
    AND public.is_admin_or_support()
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_instructor_partner_docs_manage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
    AND public.is_admin_or_support()
  );
