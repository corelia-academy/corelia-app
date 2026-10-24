-- Hackathon host logos move to the public `cdn` bucket, like course thumbnails
-- and hackathon covers in 20261023141349_public_course_hackathon_media_cdn.
--
-- hackathons.document.host.logo_url was a 1-year signed URL from the private `app`
-- bucket. New uploads (uploadContestHostLogo in src/lib/storage.ts) now go to `cdn`
-- under the same path:
--   contest-org-partner-logos/{hackathonId}/host/{file}
-- Organizational partner logos (contest-org-partner-logos/{hackathonId}/{partnerId}/)
-- stay in `app`; these policies only cover the `host` folder in `cdn`.
-- SELECT is manager-scoped for Storage remove/update; public delivery needs none.

DROP POLICY IF EXISTS cdn_contest_host_logos_select ON storage.objects;
CREATE POLICY cdn_contest_host_logos_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND (storage.foldername(name))[3] = 'host'
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_host_logos_insert ON storage.objects;
CREATE POLICY cdn_contest_host_logos_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND (storage.foldername(name))[3] = 'host'
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_host_logos_update ON storage.objects;
CREATE POLICY cdn_contest_host_logos_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND (storage.foldername(name))[3] = 'host'
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND (storage.foldername(name))[3] = 'host'
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS cdn_contest_host_logos_delete ON storage.objects;
CREATE POLICY cdn_contest_host_logos_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'contest-org-partner-logos'
    AND (storage.foldername(name))[3] = 'host'
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

-- Existing rows: same contract as before (rewrite only once the `cdn` copy exists,
-- idempotent), now also covering document.host.logo_url.
-- scripts/storage/promote-public-media-to-cdn.mjs copies the objects and calls it.
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

  UPDATE public.hackathons h
  SET document = jsonb_set(
    h.document,
    '{host,logo_url}',
    to_jsonb(split_part(h.document#>>'{host,logo_url}', '/storage/v1/object/sign/app/', 1)
      || '/storage/v1/object/public/cdn/' || (h.document#>>'{host,logo_path}'))
  )
  WHERE position('/storage/v1/object/sign/app/' IN coalesce(h.document#>>'{host,logo_url}', '')) > 0
    AND EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'cdn' AND o.name = h.document#>>'{host,logo_path}'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  promoted := promoted + affected;

  RETURN promoted;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_public_media_to_cdn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_public_media_to_cdn() TO service_role;

SELECT public.promote_public_media_to_cdn();
