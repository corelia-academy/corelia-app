-- Retire Career Tracks after the compatible UI/Edge release is live.
-- Storage objects under app/career-track-thumbnails must be removed via Storage API
-- before this migration. No statement below deletes a course or enrollment.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'app' AND name LIKE 'career-track-thumbnails/%'
  ) THEN
    RAISE EXCEPTION 'career_track_storage_not_empty';
  END IF;
END;
$$;

CREATE TEMP TABLE career_retirement_protected_counts ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.courses) AS courses,
  (SELECT count(*) FROM public.enrollments) AS enrollments,
  (SELECT count(*) FROM public.lesson_progress) AS lesson_progress,
  (SELECT count(*) FROM public.certificate_records WHERE course_id IS NOT NULL) AS course_certificates,
  (SELECT count(*) FROM public.credential_issuances WHERE course_id IS NOT NULL) AS course_credential_issuances;

CREATE TEMP TABLE career_retirement_template_ids ON COMMIT DROP AS
SELECT id FROM public.credential_templates
WHERE scope_type = 'activity_milestone'
  AND trigger_rule->>'event' = 'courses_completed_in_track';
CREATE TEMP TABLE career_retirement_issuance_ids ON COMMIT DROP AS
SELECT id FROM public.credential_issuances
WHERE template_id IN (SELECT id FROM career_retirement_template_ids);
CREATE TEMP TABLE career_retirement_campaign_ids ON COMMIT DROP AS
SELECT id FROM public.email_campaigns WHERE object_type = 'program';
CREATE TEMP TABLE career_retirement_recipient_ids ON COMMIT DROP AS
SELECT id FROM public.email_campaign_recipients
WHERE campaign_id IN (SELECT id FROM career_retirement_campaign_ids);
CREATE TEMP TABLE career_retirement_automation_ids ON COMMIT DROP AS
SELECT id FROM public.email_automations WHERE object_type = 'program';
CREATE TEMP TABLE career_retirement_list_ids ON COMMIT DROP AS
SELECT id FROM public.email_lists WHERE source_type = 'program';

-- Delete track-only mail and credential history before their parent rows.
DELETE FROM public.email_webhook_events e
USING public.email_campaign_recipients r
WHERE r.campaign_id IN (SELECT id FROM career_retirement_campaign_ids)
  AND e.provider_message_id = r.provider_message_id
  AND r.provider_message_id IS NOT NULL;
DELETE FROM public.email_audit_logs
WHERE (entity_type = 'email_campaign' AND entity_id IN (SELECT id::text FROM career_retirement_campaign_ids))
   OR (entity_type = 'email_automation' AND entity_id IN (SELECT id::text FROM career_retirement_automation_ids))
   OR (entity_type = 'email_campaign_recipient' AND entity_id IN (SELECT id::text FROM career_retirement_recipient_ids))
   OR (metadata->>'campaign_id' IN (SELECT id::text FROM career_retirement_campaign_ids))
   OR (entity_type = 'email_list' AND entity_id IN (
     SELECT l.id::text FROM public.email_lists l
     WHERE l.id IN (SELECT id FROM career_retirement_list_ids)
       AND NOT EXISTS (
         SELECT 1 FROM public.email_campaigns c
         WHERE c.list_id = l.id AND c.id NOT IN (SELECT id FROM career_retirement_campaign_ids)
       )
   ));
DELETE FROM public.email_campaigns WHERE id IN (SELECT id FROM career_retirement_campaign_ids);
DELETE FROM public.email_automations WHERE id IN (SELECT id FROM career_retirement_automation_ids);
-- Lists shared with a surviving campaign must remain to protect that campaign.
UPDATE public.email_lists SET source_type = 'manual', source_id = NULL
WHERE id IN (SELECT id FROM career_retirement_list_ids)
  AND EXISTS (SELECT 1 FROM public.email_campaigns c WHERE c.list_id = email_lists.id);
DELETE FROM public.email_lists
WHERE id IN (SELECT id FROM career_retirement_list_ids)
  AND source_type = 'program';

DELETE FROM public.email_delivery_attempts WHERE mail_type = 'career_track_announcement';
DELETE FROM public.course_blast_logs WHERE target_type = 'career_track';
DELETE FROM public.user_notifications WHERE type = 'track_announcement';
DELETE FROM public.user_notifications
WHERE type = 'oc_credential_minted'
  AND payload->>'issuance_id' IN (SELECT id::text FROM career_retirement_issuance_ids);
DELETE FROM public.email_delivery_attempts
WHERE context_type = 'oc_issuance'
  AND context_id IN (SELECT id FROM career_retirement_issuance_ids);
DELETE FROM public.credential_issuances WHERE id IN (SELECT id FROM career_retirement_issuance_ids);
DELETE FROM public.credential_templates WHERE id IN (SELECT id FROM career_retirement_template_ids);

-- knowledge_chunks and learning_paths were removed by the AI retirement migration.

UPDATE public.hackathons
SET document = document - 'related_career_track_ids' - 'relatedCareerTrackIds'
WHERE document ?| ARRAY['related_career_track_ids', 'relatedCareerTrackIds'];
UPDATE public.hackathon_locales
SET data = data - 'related_career_track_ids' - 'relatedCareerTrackIds'
WHERE data ?| ARRAY['related_career_track_ids', 'relatedCareerTrackIds'];

ALTER TABLE public.notification_preferences
  DROP COLUMN IF EXISTS email_track_blast,
  DROP COLUMN IF EXISTS in_app_track_blast;
ALTER TABLE public.course_blast_logs DROP CONSTRAINT IF EXISTS course_blast_logs_target_type_check;
ALTER TABLE public.course_blast_logs ADD CONSTRAINT course_blast_logs_target_type_check
  CHECK (target_type = 'course');
ALTER TABLE public.email_lists DROP CONSTRAINT IF EXISTS email_lists_source_type_check;
ALTER TABLE public.email_lists ADD CONSTRAINT email_lists_source_type_check
  CHECK (source_type IN ('import','luma','course','hackathon','manual'));
ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_object_type_check;
ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_object_type_check
  CHECK (object_type IS NULL OR object_type IN ('course','hackathon'));
ALTER TABLE public.email_automations DROP CONSTRAINT IF EXISTS email_automations_object_type_check;
ALTER TABLE public.email_automations ADD CONSTRAINT email_automations_object_type_check
  CHECK (object_type IS NULL OR object_type IN ('course','hackathon'));

DROP POLICY IF EXISTS storage_career_track_thumbnails_select ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_insert ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_update ON storage.objects;
DROP POLICY IF EXISTS storage_career_track_thumbnails_delete ON storage.objects;

-- Preserve non-track search results and campaign behavior.
CREATE OR REPLACE FUNCTION public.search_public(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  href text,
  rank numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_has_public_profiles boolean := (to_regclass('public.public_profiles') IS NOT NULL);
  v_sql text;
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  v_sql := $SQL$
    WITH q AS (
      SELECT $1::text AS query
    ),
    projects_res AS (
      SELECT
        'project'::text AS entity_type,
        p.id::text AS entity_id,
        p.title AS title,
        NULL::text AS subtitle,
        '/projects'::text AS href,
        (similarity(lower(p.title), q.query) + CASE WHEN lower(p.title) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.projects p, q
      WHERE p.visibility = 'public'
        AND (lower(p.title) LIKE ('%' || q.query || '%') OR lower(coalesce(p.summary, '')) LIKE ('%' || q.query || '%'))
    ),
    hackathons_res AS (
      SELECT
        'hackathon'::text AS entity_type,
        h.id::text AS entity_id,
        coalesce(nullif(h.document->>'title',''), h.id)::text AS title,
        nullif(h.document->>'tagline','')::text AS subtitle,
        ('/hackathons/' || h.id || '/overview')::text AS href,
        (similarity(lower(coalesce(h.document->>'title','')), q.query)
          + CASE WHEN lower(coalesce(h.document->>'title','')) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        h.updated_at AS updated_at
      FROM public.hackathons h, q
      WHERE h.status IN ('published','running','ended')
        AND (
          lower(coalesce(h.document->>'title','')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(h.document->>'tagline','')) LIKE ('%' || q.query || '%')
        )
    ),
    courses_res AS (
      SELECT
        'course'::text AS entity_type,
        co.id::text AS entity_id,
        coalesce(nullif(co.data->>'title',''), co.id)::text AS title,
        nullif(co.data->>'tagline','')::text AS subtitle,
        ('/courses/' || co.id)::text AS href,
        (similarity(lower(coalesce(co.data->>'title','')), q.query)
          + CASE WHEN lower(coalesce(co.data->>'title','')) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        co.updated_at AS updated_at
      FROM public.courses co, q
      WHERE co.published = true
        AND (
          lower(coalesce(co.data->>'title','')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(co.slug,'')) LIKE ('%' || q.query || '%')
        )
    )
  $SQL$;

  IF v_has_public_profiles THEN
    v_sql := v_sql || $SQL$
    ,
    profiles_res AS (
      SELECT
        'profile'::text AS entity_type,
        p.id::text AS entity_id,
        coalesce(nullif(p.full_name,''), nullif(p.username,''), nullif(p.ocid,''), p.id::text)::text AS title,
        coalesce(nullif(p.username,''), nullif(p.ocid,''))::text AS subtitle,
        ('/u/' || coalesce(nullif(p.username,''), nullif(p.ocid,''), p.id::text))::text AS href,
        (greatest(
          similarity(lower(coalesce(p.username,'')), q.query),
          similarity(lower(coalesce(p.ocid,'')), q.query),
          similarity(lower(coalesce(p.full_name,'')), q.query)
        )
        + CASE
            WHEN lower(coalesce(p.username,'')) LIKE (q.query || '%') THEN 1
            WHEN lower(coalesce(p.ocid,'')) LIKE (q.query || '%') THEN 1
            WHEN lower(coalesce(p.full_name,'')) LIKE (q.query || '%') THEN 1
            ELSE 0
          END
        )::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.public_profiles p, q
      WHERE p.profile_public = true
        AND (
          lower(coalesce(p.username,'')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(p.ocid,'')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(p.full_name,'')) LIKE ('%' || q.query || '%')
        )
    )
    $SQL$;
  END IF;

  v_sql := v_sql || $SQL$
    ,
    unioned AS (
      SELECT * FROM projects_res
      UNION ALL SELECT * FROM hackathons_res
      UNION ALL SELECT * FROM courses_res
  $SQL$;

  IF v_has_public_profiles THEN
    v_sql := v_sql || $SQL$
      UNION ALL SELECT * FROM profiles_res
    $SQL$;
  END IF;

  v_sql := v_sql || $SQL$
    )
    SELECT
      u.entity_type,
      u.entity_id,
      u.title,
      u.subtitle,
      u.href,
      u.rank
    FROM unioned u
    ORDER BY u.rank DESC, u.updated_at DESC
    LIMIT $2 OFFSET $3
  $SQL$;

  RETURN QUERY EXECUTE v_sql USING v_query, v_limit, v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public(text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_prepare_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.email_campaigns%ROWTYPE;
  v_limit bigint;
  v_total bigint;
  v_eligible bigint;
BEGIN
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.status <> 'draft' THEN RAISE EXCEPTION 'campaign_not_draft'; END IF;
  SELECT max_recipients_per_campaign INTO v_limit FROM public.email_settings WHERE singleton;
  IF v_campaign.audience_type = 'all_contacts' THEN
    SELECT count(*) INTO v_total FROM public.email_contacts;
  ELSE
    SELECT count(*) INTO v_total FROM public.email_list_members WHERE list_id = v_campaign.list_id;
  END IF;
  IF v_total > v_limit THEN RAISE EXCEPTION 'campaign_operational_limit_exceeded:%', v_total; END IF;

  INSERT INTO public.email_campaign_recipients (
    campaign_id, contact_id, recipient_email, personalization, status
  )
  SELECT
    v_campaign.id,
    c.id,
    c.email,
    jsonb_build_object('name', coalesce(c.full_name, ''), 'locale', c.locale),
    CASE
      WHEN c.global_suppressed_at IS NOT NULL THEN 'suppressed'
      WHEN v_campaign.purpose = 'marketing' AND NOT EXISTS (
        SELECT 1 FROM public.email_contact_consents cc
        WHERE cc.contact_id = c.id AND cc.topic = 'marketing' AND cc.status = 'subscribed'
      ) THEN 'suppressed'
      WHEN v_campaign.object_type = 'course' AND EXISTS (
        SELECT 1 FROM public.notification_preferences np
        WHERE np.user_id = c.user_id AND np.email_course_blast = false
      ) THEN 'suppressed'
      ELSE 'queued'
    END
  FROM public.email_contacts c
  WHERE v_campaign.audience_type = 'all_contacts'
     OR EXISTS (
       SELECT 1 FROM public.email_list_members lm
       WHERE lm.list_id = v_campaign.list_id AND lm.contact_id = c.id
     )
  ON CONFLICT (campaign_id, contact_id) DO NOTHING;

  SELECT count(*) FILTER (WHERE status = 'queued')
    INTO v_eligible
  FROM public.email_campaign_recipients
  WHERE campaign_id = v_campaign.id;

  UPDATE public.email_campaigns SET
    status = 'ready',
    estimated_recipients = v_total,
    prepared_recipients = v_eligible,
    suppressed_count = v_total - v_eligible,
    updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object('total', v_total, 'eligible', v_eligible, 'suppressed', v_total - v_eligible);
END;
$$;
REVOKE ALL ON FUNCTION public.email_prepare_campaign(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_prepare_campaign(uuid) TO service_role;


DROP TABLE public.career_track_locales;
DROP TABLE public.career_track_courses;
DROP TABLE public.career_tracks;

DO $$
DECLARE before_counts record;
BEGIN
  SELECT * INTO before_counts FROM career_retirement_protected_counts;
  IF (SELECT count(*) FROM public.courses) <> before_counts.courses
    OR (SELECT count(*) FROM public.enrollments) <> before_counts.enrollments
    OR (SELECT count(*) FROM public.lesson_progress) <> before_counts.lesson_progress
    OR (SELECT count(*) FROM public.certificate_records WHERE course_id IS NOT NULL) <> before_counts.course_certificates
    OR (SELECT count(*) FROM public.credential_issuances WHERE course_id IS NOT NULL) <> before_counts.course_credential_issuances
  THEN
    RAISE EXCEPTION 'protected_course_data_changed';
  END IF;
END;
$$;
COMMIT;
