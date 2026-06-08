-- Migration: Add certificate-templates path to CDN bucket.
--
-- Certificate templates were previously stored in the private `app` bucket
-- with 1-year signed URLs. Moving them to the public `cdn` bucket gives:
--   - Permanent non-expiring URLs (cdn.corelia.academy/certificate-templates/...)
--   - No CORS issues when rendering certificates client-side via canvas/fetch
--   - Right-click "Open Image in New Tab" shows the certificate correctly
--
-- Path layout: certificate-templates/{courseId}/{timestamp}.{ext}

-- ─────────────────────────────────────────────────────────────
-- Certificate templates — managed by course instructors
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_certificate_templates_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course(
          (storage.foldername(name))[2],
          (SELECT auth.uid())
        )
  );

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
  );

CREATE POLICY cdn_certificate_templates_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificate-templates'
    AND private.can_manage_course(
          (storage.foldername(name))[2],
          (SELECT auth.uid())
        )
  );
