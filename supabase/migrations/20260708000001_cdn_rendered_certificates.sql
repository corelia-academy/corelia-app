-- Migration: CDN bucket policies for rendered certificate PNGs.
--
-- When a learner opens their certificate preview, the frontend renders
-- the template + name overlay onto a canvas and uploads the result to
-- cdn.corelia.academy/certificates/{userId}/{courseId}.png (upsert).
-- This gives a permanent shareable URL with the name already baked in.
--
-- Path layout: certificates/{userId}/{courseId}.png

-- Each learner can only write to their own path (foldername[2] = their userId).
CREATE POLICY cdn_rendered_certificates_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
  );

CREATE POLICY cdn_rendered_certificates_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
  );

CREATE POLICY cdn_rendered_certificates_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
  );
