-- Fix rendered certificate uploads for course OCA claims.
--
-- The frontend writes name-rendered certificate PNGs to:
--   cdn/certificates/{userId}/{courseId}.png
--
-- Supabase Storage upsert/update paths need read visibility plus UPDATE
-- checks. Keep the learner-only write boundary: users may only write under
-- their own user id folder.

DROP POLICY IF EXISTS cdn_rendered_certificates_select ON storage.objects;
CREATE POLICY cdn_rendered_certificates_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2] = ((SELECT auth.uid())::text)
  );

DROP POLICY IF EXISTS cdn_rendered_certificates_update ON storage.objects;
CREATE POLICY cdn_rendered_certificates_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2] = ((SELECT auth.uid())::text)
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2] = ((SELECT auth.uid())::text)
  );
