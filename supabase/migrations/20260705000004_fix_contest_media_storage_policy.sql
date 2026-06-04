-- The original storage_contest_media_write policy only allowed admins/support
-- to upload contest banners and thumbnails. Contest managers (organizers) also
-- need write access to their own contest's media.

DROP POLICY IF EXISTS storage_contest_media_write ON storage.objects;

CREATE POLICY storage_contest_media_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

CREATE POLICY storage_contest_media_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );

CREATE POLICY storage_contest_media_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
    AND (
      public.is_admin_or_support()
      OR private.can_manage_hackathon((storage.foldername(name))[2], (SELECT auth.uid()))
    )
  );
