-- The migration's transaction guards preserved courses, enrollments, and course awards.
DO $$
BEGIN
  IF to_regclass('public.career_tracks') IS NOT NULL
    OR to_regclass('public.career_track_courses') IS NOT NULL
    OR to_regclass('public.career_track_locales') IS NOT NULL
    OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'app' AND name LIKE 'career-track-thumbnails/%')
    OR EXISTS (SELECT 1 FROM public.course_blast_logs WHERE target_type = 'career_track')
    OR EXISTS (SELECT 1 FROM public.email_delivery_attempts WHERE mail_type = 'career_track_announcement')
    OR EXISTS (SELECT 1 FROM public.user_notifications WHERE type = 'track_announcement')
    OR EXISTS (SELECT 1 FROM public.credential_templates WHERE scope_type = 'activity_milestone' AND trigger_rule->>'event' = 'courses_completed_in_track')
    OR EXISTS (SELECT 1 FROM public.email_campaigns WHERE object_type = 'program')
    OR EXISTS (SELECT 1 FROM public.email_automations WHERE object_type = 'program')
    OR EXISTS (SELECT 1 FROM public.email_lists WHERE source_type = 'program')
    OR EXISTS (SELECT 1 FROM public.hackathons WHERE document ?| ARRAY['related_career_track_ids','relatedCareerTrackIds'])
    OR EXISTS (SELECT 1 FROM public.hackathon_locales WHERE data ?| ARRAY['related_career_track_ids','relatedCareerTrackIds'])
  THEN RAISE EXCEPTION 'career_tracks_retirement_incomplete'; END IF;
  RAISE NOTICE 'Career Tracks retired. Protected counts: %', (
    SELECT jsonb_build_object(
      'courses', (SELECT count(*) FROM public.courses),
      'enrollments', (SELECT count(*) FROM public.enrollments),
      'lesson_progress', (SELECT count(*) FROM public.lesson_progress),
      'course_certificates', (SELECT count(*) FROM public.certificate_records WHERE course_id IS NOT NULL),
      'course_credential_issuances', (SELECT count(*) FROM public.credential_issuances WHERE course_id IS NOT NULL)
    )
  );
END;
$$;
