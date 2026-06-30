-- Learning track hero media: image or YouTube video.

ALTER TABLE public.career_tracks
  ADD COLUMN IF NOT EXISTS hero_media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS hero_youtube_url text,
  ADD COLUMN IF NOT EXISTS hero_youtube_video_id text;

ALTER TABLE public.career_tracks
  DROP CONSTRAINT IF EXISTS career_tracks_hero_media_type_check;

ALTER TABLE public.career_tracks
  ADD CONSTRAINT career_tracks_hero_media_type_check
    CHECK (hero_media_type IN ('image', 'youtube'));

-- Private app bucket path used by src/lib/storage.ts: uploadCareerTrackThumbnail().
DROP POLICY IF EXISTS storage_career_track_thumbnails_select ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_insert ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_update ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_delete ON storage.objects;

CREATE POLICY storage_career_track_thumbnails_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'career-track-thumbnails'
    AND (
      public.is_admin_or_support()
      OR EXISTS (
        SELECT 1
        FROM public.career_tracks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_scope = 'instructor'
          AND t.instructor_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY storage_career_track_thumbnails_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'career-track-thumbnails'
    AND (
      public.is_admin_or_support()
      OR EXISTS (
        SELECT 1
        FROM public.career_tracks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_scope = 'instructor'
          AND t.instructor_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY storage_career_track_thumbnails_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'career-track-thumbnails'
    AND (
      public.is_admin_or_support()
      OR EXISTS (
        SELECT 1
        FROM public.career_tracks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_scope = 'instructor'
          AND t.instructor_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'career-track-thumbnails'
    AND (
      public.is_admin_or_support()
      OR EXISTS (
        SELECT 1
        FROM public.career_tracks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_scope = 'instructor'
          AND t.instructor_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY storage_career_track_thumbnails_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'career-track-thumbnails'
    AND (
      public.is_admin_or_support()
      OR EXISTS (
        SELECT 1
        FROM public.career_tracks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_scope = 'instructor'
          AND t.instructor_id = (SELECT auth.uid())
      )
    )
  );
