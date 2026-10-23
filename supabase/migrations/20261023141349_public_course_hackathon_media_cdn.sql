-- Public course/hackathon artwork moves to the public `cdn` bucket.
--
-- Course thumbnails (courses.data.thumbnail_url) and hackathon covers/thumbnails
-- (hackathons.document.cover_image_url / thumbnail_url) were stored as 1-year
-- signed URLs from the private `app` bucket, so the app, the landing catalog and
-- JSON-LD stop showing them once the token expires. New uploads now go to `cdn`
-- under the same path layout (src/lib/storage.ts) and store a permanent URL.
--
-- Path layout inside `cdn` (same as the legacy `app` paths):
--   course-thumbnails/{courseId}/{file}
--   contest-banners/{hackathonId}/{file}
--   contest-thumbnails/{hackathonId}/{file}
-- Lesson images keep living in `app` under course-thumbnails/{courseId}/lessons/
-- and are signed on read; these policies apply to the `cdn` bucket only.
--
-- Public delivery uses the public object path and needs no SELECT policy. The
-- manager-scoped SELECT policies below exist because Storage remove/update must
-- see the row (cdn_public_read was dropped to stop listing), mirroring
-- cdn_rendered_certificates_select. They do not let anyone else list the bucket.

-- ─────────────────────────────────────────────────────────────
-- 1. Course thumbnails — same managers as the `app` policies
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cdn_course_thumbnails_select ON storage.objects;
CREATE POLICY cdn_course_thumbnails_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS cdn_course_thumbnails_insert ON storage.objects;
CREATE POLICY cdn_course_thumbnails_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS cdn_course_thumbnails_update ON storage.objects;
CREATE POLICY cdn_course_thumbnails_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS cdn_course_thumbnails_delete ON storage.objects;
CREATE POLICY cdn_course_thumbnails_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Hackathon covers/thumbnails — same managers as storage_contest_media_*
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cdn_contest_media_select ON storage.objects;
CREATE POLICY cdn_contest_media_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] IN ('contest-banners', 'contest-thumbnails')
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_media_insert ON storage.objects;
CREATE POLICY cdn_contest_media_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] IN ('contest-banners', 'contest-thumbnails')
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_media_update ON storage.objects;
CREATE POLICY cdn_contest_media_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] IN ('contest-banners', 'contest-thumbnails')
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] IN ('contest-banners', 'contest-thumbnails')
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_media_delete ON storage.objects;
CREATE POLICY cdn_contest_media_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] IN ('contest-banners', 'contest-thumbnails')
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Existing rows
--    SQL cannot copy Storage bytes, so scripts/storage/promote-public-media-to-cdn.mjs
--    copies each referenced `app` object to the same `cdn` path and then calls this
--    function. It rewrites a stored signed `app` URL to the permanent public `cdn`
--    URL on the same host only when the `cdn` copy exists, so it is safe to run
--    before, during or after the copy and any number of times. Rows whose objects
--    are not copied yet keep their current (still valid) signed URL.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.promote_public_media_to_cdn()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  promoted integer := 0;
  affected integer;
BEGIN
  UPDATE public.courses c
  SET data = jsonb_set(
    c.data,
    '{thumbnail_url}',
    to_jsonb(split_part(c.data->>'thumbnail_url', '/storage/v1/object/sign/app/', 1)
      || '/storage/v1/object/public/cdn/' || (c.data->>'thumbnail_path'))
  )
  WHERE position('/storage/v1/object/sign/app/' IN coalesce(c.data->>'thumbnail_url', '')) > 0
    AND EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'cdn' AND o.name = c.data->>'thumbnail_path'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  promoted := promoted + affected;

  UPDATE public.hackathons h
  SET document = jsonb_set(
    h.document,
    '{cover_image_url}',
    to_jsonb(split_part(h.document->>'cover_image_url', '/storage/v1/object/sign/app/', 1)
      || '/storage/v1/object/public/cdn/' || (h.document->>'cover_image_path'))
  )
  WHERE position('/storage/v1/object/sign/app/' IN coalesce(h.document->>'cover_image_url', '')) > 0
    AND EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'cdn' AND o.name = h.document->>'cover_image_path'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  promoted := promoted + affected;

  UPDATE public.hackathons h
  SET document = jsonb_set(
    h.document,
    '{thumbnail_url}',
    to_jsonb(split_part(h.document->>'thumbnail_url', '/storage/v1/object/sign/app/', 1)
      || '/storage/v1/object/public/cdn/' || (h.document->>'thumbnail_path'))
  )
  WHERE position('/storage/v1/object/sign/app/' IN coalesce(h.document->>'thumbnail_url', '')) > 0
    AND EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'cdn' AND o.name = h.document->>'thumbnail_path'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  promoted := promoted + affected;

  RETURN promoted;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_public_media_to_cdn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_public_media_to_cdn() TO service_role;

SELECT public.promote_public_media_to_cdn();
