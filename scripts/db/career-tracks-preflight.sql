-- Read-only inventory for the Staging Career Tracks retirement.
SELECT jsonb_pretty(jsonb_build_object(
  'protected', jsonb_build_object(
    'courses', (SELECT count(*) FROM public.courses),
    'enrollments', (SELECT count(*) FROM public.enrollments),
    'lesson_progress', (SELECT count(*) FROM public.lesson_progress),
    'course_certificates', (SELECT count(*) FROM public.certificate_records WHERE course_id IS NOT NULL),
    'course_credential_issuances', (SELECT count(*) FROM public.credential_issuances WHERE course_id IS NOT NULL)
  ),
  'career_tracks', (SELECT count(*) FROM public.career_tracks),
  'career_track_courses', (SELECT count(*) FROM public.career_track_courses),
  'career_track_locales', (SELECT count(*) FROM public.career_track_locales),
  'career_track_storage_objects', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'app' AND name LIKE 'career-track-thumbnails/%'),
  'track_blast_logs', (SELECT count(*) FROM public.course_blast_logs WHERE target_type = 'career_track'),
  'track_delivery_attempts', (SELECT count(*) FROM public.email_delivery_attempts WHERE mail_type = 'career_track_announcement'),
  'track_notifications', (SELECT count(*) FROM public.user_notifications WHERE type = 'track_announcement'),
  'track_credential_notifications', (SELECT count(*) FROM public.user_notifications n JOIN public.credential_issuances i ON n.payload->>'issuance_id' = i.id::text JOIN public.credential_templates t ON t.id = i.template_id WHERE n.type = 'oc_credential_minted' AND t.scope_type = 'activity_milestone' AND t.trigger_rule->>'event' = 'courses_completed_in_track'),
  'track_milestone_templates', (SELECT count(*) FROM public.credential_templates WHERE scope_type = 'activity_milestone' AND trigger_rule->>'event' = 'courses_completed_in_track'),
  'track_milestone_issuances', (SELECT count(*) FROM public.credential_issuances i JOIN public.credential_templates t ON t.id = i.template_id WHERE t.scope_type = 'activity_milestone' AND t.trigger_rule->>'event' = 'courses_completed_in_track'),
  'track_pending_credential_issuances', (SELECT count(*) FROM public.pending_credential_issuances p JOIN public.credential_templates t ON t.id = p.template_id WHERE t.scope_type = 'activity_milestone' AND t.trigger_rule->>'event' = 'courses_completed_in_track'),
  'externally_minted_track_credentials', (SELECT count(*) FROM public.credential_issuances i JOIN public.credential_templates t ON t.id = i.template_id WHERE t.scope_type = 'activity_milestone' AND t.trigger_rule->>'event' = 'courses_completed_in_track' AND i.status = 'minted'),
  'program_campaigns', (SELECT count(*) FROM public.email_campaigns WHERE object_type = 'program'),
  'program_campaign_recipients', (SELECT count(*) FROM public.email_campaign_recipients r JOIN public.email_campaigns c ON c.id = r.campaign_id WHERE c.object_type = 'program'),
  'program_campaign_audit_logs', (SELECT count(*) FROM public.email_audit_logs a WHERE (a.entity_type = 'email_campaign' AND a.entity_id IN (SELECT id::text FROM public.email_campaigns WHERE object_type = 'program')) OR a.metadata->>'campaign_id' IN (SELECT id::text FROM public.email_campaigns WHERE object_type = 'program') OR (a.entity_type = 'email_campaign_recipient' AND a.entity_id IN (SELECT r.id::text FROM public.email_campaign_recipients r JOIN public.email_campaigns c ON c.id = r.campaign_id WHERE c.object_type = 'program'))),
  'program_automations', (SELECT count(*) FROM public.email_automations WHERE object_type = 'program'),
  'program_automation_enrollments', (SELECT count(*) FROM public.email_automation_enrollments e JOIN public.email_automations a ON a.id = e.automation_id WHERE a.object_type = 'program'),
  'program_lists', (SELECT count(*) FROM public.email_lists WHERE source_type = 'program'),
  'hackathon_documents_with_track_links', (SELECT count(*) FROM public.hackathons WHERE document ?| ARRAY['related_career_track_ids','relatedCareerTrackIds']),
  'hackathon_locales_with_track_links', (SELECT count(*) FROM public.hackathon_locales WHERE data ?| ARRAY['related_career_track_ids','relatedCareerTrackIds'])
)) AS career_tracks_retirement_preflight;
