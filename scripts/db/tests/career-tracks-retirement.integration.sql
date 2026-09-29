DO $$
BEGIN
  IF to_regclass('public.career_tracks') IS NOT NULL
    OR to_regclass('public.career_track_courses') IS NOT NULL
    OR to_regclass('public.career_track_locales') IS NOT NULL
  THEN RAISE EXCEPTION 'career_tracks_tables_remain'; END IF;
  IF to_regclass('public.courses') IS NULL OR to_regclass('public.enrollments') IS NULL
  THEN RAISE EXCEPTION 'course_tables_missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.notification_preferences'::regclass
    AND attname IN ('email_track_blast','in_app_track_blast') AND NOT attisdropped)
  THEN RAISE EXCEPTION 'track_preferences_remain'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='app' AND name LIKE 'career-track-thumbnails/%')
  THEN RAISE EXCEPTION 'track_storage_remains'; END IF;
  IF EXISTS (SELECT 1 FROM public.search_public('course', 20, 0) WHERE entity_type = 'career_track')
  THEN RAISE EXCEPTION 'career_track_search_result_remains'; END IF;
END;
$$;
