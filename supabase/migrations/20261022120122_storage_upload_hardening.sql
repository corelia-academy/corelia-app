-- Bound what browsers can store in the `cdn` and `app` buckets.
--
-- cdn (public): every writer uploads raster images (credential badges, certificate
-- templates, brand logo, rendered certificate PNGs). SVG is excluded because the
-- bucket is served publicly and SVG can carry script.
-- app (private): course/contest/project/lesson images plus final-assignment
-- attachments (.pdf/.doc/.docx/.zip, see FinalAssignmentPanel). 25 MB covers the
-- largest attachment while capping per-object storage cost.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id = 'cdn';

UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/png','image/jpeg','image/webp','image/gif','image/avif',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip','application/x-zip-compressed'
    ]
WHERE id = 'app';

-- Rendered certificates: exactly certificates/{uid}/{courseId}.png for a course
-- whose certificate was issued to that user (revocation clears certificate_issued_at).
CREATE FUNCTION private.storage_rendered_certificate_owned(p_name text,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.enrollments e
  WHERE e.user_id=p_user AND e.certificate_issued_at IS NOT NULL
   AND p_name='certificates/'||p_user::text||'/'||e.course_id||'.png')
$$;
REVOKE ALL ON FUNCTION private.storage_rendered_certificate_owned(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.storage_rendered_certificate_owned(text,uuid) TO authenticated;

DROP POLICY IF EXISTS cdn_rendered_certificates_insert ON storage.objects;
CREATE POLICY cdn_rendered_certificates_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'certificates'
    AND private.storage_rendered_certificate_owned(name, (SELECT auth.uid()))
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
    AND private.storage_rendered_certificate_owned(name, (SELECT auth.uid()))
  );

-- Final-assignment uploads: the course folder must be one the learner is enrolled in.
CREATE FUNCTION private.storage_is_enrolled(p_course text,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user IS NOT NULL AND EXISTS(SELECT 1 FROM public.enrollments e WHERE e.user_id=p_user AND e.course_id=p_course)
$$;
REVOKE ALL ON FUNCTION private.storage_is_enrolled(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.storage_is_enrolled(text,uuid) TO authenticated;

DROP POLICY storage_final_submissions_insert ON storage.objects;
CREATE POLICY storage_final_submissions_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='app' AND (storage.foldername(name))[1]='final-assignment-submissions'
 AND (storage.foldername(name))[3]=(SELECT auth.uid())::text
 AND private.learning_course_visible((storage.foldername(name))[2])
 AND private.storage_is_enrolled((storage.foldername(name))[2],(SELECT auth.uid())));
