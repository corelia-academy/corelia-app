-- Canonical project media and AI-gated write boundary.

ALTER TABLE public.projects
  ADD COLUMN logo_path text,
  ADD COLUMN screenshot_paths text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.projects
  ADD CONSTRAINT projects_screenshot_paths_limit
  CHECK (cardinality(screenshot_paths) <= 6);

CREATE TABLE public.project_media_uploads (
  path text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX project_media_uploads_expiry_idx
  ON public.project_media_uploads (expires_at);
COMMENT ON TABLE public.project_media_uploads IS
  'Ephemeral operational registry for AI-approved project uploads awaiting a successful project save.';
ALTER TABLE public.project_media_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_media_uploads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_media_uploads TO service_role;

UPDATE public.hackathon_submissions
SET document = document - 'cover_image_url' - 'screenshot_url';

DROP TRIGGER IF EXISTS trg_sync_project_from_hackathon_submission
  ON public.hackathon_submissions;
DROP FUNCTION IF EXISTS private.sync_project_from_hackathon_submission();

DROP FUNCTION IF EXISTS public.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
);
DROP FUNCTION IF EXISTS private.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
);

ALTER TABLE public.projects
  DROP COLUMN cover_image_url,
  DROP COLUMN screenshot_url;

-- Direct browser writes could bypass moderation. Reads and owner deletes keep
-- their existing RLS behavior; content mutations are service-only RPCs.
REVOKE INSERT, UPDATE ON public.projects FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.project_locales FROM authenticated;
REVOKE INSERT, UPDATE ON public.hackathon_submissions FROM authenticated;

CREATE OR REPLACE FUNCTION public.save_ai_gated_project(
  p_actor_id uuid,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_logo_path text DEFAULT NULL,
  p_screenshot_paths text[] DEFAULT '{}'::text[],
  p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'standalone',
  p_source_id text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}'::text[],
  p_sector_ids text[] DEFAULT '{}'::text[],
  p_tech_stack_ids text[] DEFAULT '{}'::text[]
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_is_staff boolean := false;
  v_is_new boolean := false;
  v_document jsonb;
  v_deadline timestamptz;
  v_submission_id text;
  v_linked_project_id uuid;
  v_tracks text[] := '{}'::text[];
  v_sectors text[] := '{}'::text[];
  v_tech_stacks text[] := '{}'::text[];
  v_source_type text;
  v_source_id text;
  v_owner_id uuid;
  v_media_prefix text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_identity';
  END IF;
  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input:project_title';
  END IF;
  IF lower(btrim(COALESCE(p_slug, ''))) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_input:project_slug';
  END IF;
  IF p_visibility NOT IN ('public', 'unlisted', 'private') THEN
    RAISE EXCEPTION 'invalid_input:project_visibility';
  END IF;
  IF cardinality(COALESCE(p_screenshot_paths, '{}'::text[])) > 6 THEN
    RAISE EXCEPTION 'invalid_input:project_screenshot_limit';
  END IF;

  SELECT COALESCE(pr.role IN ('admin', 'support_staff'), false)
  INTO v_is_staff
  FROM public.profiles pr
  WHERE pr.id = p_actor_id;

  SELECT * INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_project.owner_id <> p_actor_id AND NOT v_is_staff THEN
      RAISE EXCEPTION 'forbidden:project_update';
    END IF;
    v_owner_id := v_project.owner_id;
    v_source_type := v_project.source_type;
    v_source_id := v_project.source_id;
  ELSE
    v_is_new := true;
    v_owner_id := p_actor_id;
    v_source_type := COALESCE(NULLIF(btrim(p_source_type), ''), 'standalone');
    v_source_id := NULLIF(btrim(p_source_id), '');
    IF v_source_type NOT IN ('standalone', 'hackathon') THEN
      RAISE EXCEPTION 'forbidden:project_source_create';
    END IF;
  END IF;

  v_media_prefix := 'project-media/' || v_owner_id::text || '/' || p_project_id::text || '/';
  IF NULLIF(btrim(COALESCE(p_logo_path, '')), '') IS NOT NULL
    AND p_logo_path NOT LIKE v_media_prefix || 'logo/%'
  THEN
    RAISE EXCEPTION 'invalid_input:project_logo_path';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_screenshot_paths, '{}'::text[])) path
    WHERE path NOT LIKE v_media_prefix || 'screenshots/%'
  ) THEN
    RAISE EXCEPTION 'invalid_input:project_screenshot_path';
  END IF;

  -- A referenced object must either already belong to the saved project or be
  -- present in the short-lived registry populated only after image moderation.
  IF NULLIF(btrim(COALESCE(p_logo_path, '')), '') IS NOT NULL
    AND NOT (
      (NOT v_is_new AND p_logo_path = v_project.logo_path)
      OR EXISTS (
        SELECT 1 FROM public.project_media_uploads u
        WHERE u.path = p_logo_path
          AND u.owner_id = v_owner_id
          AND u.project_id = p_project_id
          AND u.expires_at > v_now
      )
    )
  THEN
    RAISE EXCEPTION 'invalid_input:project_logo_upload';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_screenshot_paths, '{}'::text[])) path
    WHERE NOT (
      (NOT v_is_new AND path = ANY(COALESCE(v_project.screenshot_paths, '{}'::text[])))
      OR EXISTS (
        SELECT 1 FROM public.project_media_uploads u
        WHERE u.path = path
          AND u.owner_id = v_owner_id
          AND u.project_id = p_project_id
          AND u.expires_at > v_now
      )
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input:project_screenshot_upload';
  END IF;

  IF v_source_type IN ('contest', 'hackathon') THEN
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION 'invalid_input:hackathon_id';
    END IF;
    SELECT h.document INTO v_document
    FROM public.hackathons h
    WHERE h.id = v_source_id
      AND h.status IN ('published', 'running', 'ended');
    IF v_document IS NULL THEN
      RAISE EXCEPTION 'not_found:hackathon';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.hackathon_registrations r
      WHERE r.hackathon_id = v_source_id
        AND r.user_id = v_owner_id
        AND r.document->>'status' IN ('registered', 'approved')
    ) THEN
      RAISE EXCEPTION 'forbidden:registration_required';
    END IF;

    BEGIN
      v_deadline := COALESCE(
        NULLIF(v_document->>'submission_deadline', '')::timestamptz,
        NULLIF(v_document->>'ends_at', '')::timestamptz
      );
    EXCEPTION WHEN OTHERS THEN
      v_deadline := NULL;
    END;
    IF v_deadline IS NOT NULL AND v_now > v_deadline THEN
      RAISE EXCEPTION 'forbidden:submission_deadline_passed';
    END IF;

    v_submission_id := v_source_id || '_' || v_owner_id::text;
    SELECT hs.project_id INTO v_linked_project_id
    FROM public.hackathon_submissions hs
    WHERE hs.id = v_submission_id;
    IF v_linked_project_id IS NOT NULL AND v_linked_project_id <> p_project_id THEN
      RAISE EXCEPTION 'conflict:hackathon_project_exists';
    END IF;

    SELECT COALESCE(array_agg(item->>'id'), '{}'::text[]) INTO v_tracks
    FROM jsonb_array_elements(COALESCE(v_document->'tracks', '[]'::jsonb)) item
    WHERE COALESCE(item->>'active', 'true') <> 'false';
    SELECT COALESCE(array_agg(item->>'id'), '{}'::text[]) INTO v_sectors
    FROM jsonb_array_elements(COALESCE(v_document->'sectors', '[]'::jsonb)) item
    WHERE COALESCE(item->>'active', 'true') <> 'false';
    SELECT COALESCE(array_agg(item->>'id'), '{}'::text[]) INTO v_tech_stacks
    FROM jsonb_array_elements(COALESCE(v_document->'tech_stacks', '[]'::jsonb)) item
    WHERE COALESCE(item->>'active', 'true') <> 'false';

    IF cardinality(COALESCE(p_track_ids, '{}'::text[])) = 0
      OR cardinality(COALESCE(p_sector_ids, '{}'::text[])) = 0
      OR cardinality(COALESCE(p_tech_stack_ids, '{}'::text[])) = 0
    THEN
      RAISE EXCEPTION 'invalid_input:project_taxonomy_required';
    END IF;
    IF NOT p_track_ids <@ v_tracks
      OR NOT p_sector_ids <@ v_sectors
      OR NOT p_tech_stack_ids <@ v_tech_stacks
    THEN
      RAISE EXCEPTION 'invalid_input:project_taxonomy';
    END IF;
  END IF;

  IF v_is_new THEN
    INSERT INTO public.projects (
      id, owner_id, slug, title, summary, demo_url, repo_url, slide_url,
      video_url, logo_path, screenshot_paths, visibility, source_type,
      source_id, source_submission_id, hackathon_track_ids,
      hackathon_sector_ids, hackathon_tech_stack_ids, created_at, updated_at
    ) VALUES (
      p_project_id, v_owner_id, lower(btrim(p_slug)), btrim(p_title),
      NULLIF(btrim(p_summary), ''), NULLIF(btrim(p_demo_url), ''),
      NULLIF(btrim(p_repo_url), ''), NULLIF(btrim(p_slide_url), ''),
      NULLIF(btrim(p_video_url), ''), NULLIF(btrim(p_logo_path), ''),
      COALESCE(p_screenshot_paths, '{}'::text[]),
      CASE WHEN v_source_type = 'hackathon' THEN 'public' ELSE p_visibility END,
      v_source_type, v_source_id, v_submission_id,
      COALESCE(p_track_ids, '{}'::text[]), COALESCE(p_sector_ids, '{}'::text[]),
      COALESCE(p_tech_stack_ids, '{}'::text[]), v_now, v_now
    );
  ELSE
    UPDATE public.projects
    SET slug = lower(btrim(p_slug)),
        title = btrim(p_title),
        summary = NULLIF(btrim(p_summary), ''),
        demo_url = NULLIF(btrim(p_demo_url), ''),
        repo_url = NULLIF(btrim(p_repo_url), ''),
        slide_url = NULLIF(btrim(p_slide_url), ''),
        video_url = NULLIF(btrim(p_video_url), ''),
        logo_path = NULLIF(btrim(p_logo_path), ''),
        screenshot_paths = COALESCE(p_screenshot_paths, '{}'::text[]),
        visibility = CASE WHEN v_source_type IN ('contest', 'hackathon') THEN 'public' ELSE p_visibility END,
        hackathon_track_ids = COALESCE(p_track_ids, '{}'::text[]),
        hackathon_sector_ids = COALESCE(p_sector_ids, '{}'::text[]),
        hackathon_tech_stack_ids = COALESCE(p_tech_stack_ids, '{}'::text[]),
        updated_at = v_now
    WHERE id = p_project_id;
  END IF;

  IF v_source_type IN ('contest', 'hackathon') THEN
    INSERT INTO public.hackathon_submissions (id, hackathon_id, user_id, project_id, document)
    VALUES (
      v_submission_id,
      v_source_id,
      v_owner_id,
      p_project_id,
      jsonb_build_object(
        'registration_id', v_source_id || '_' || v_owner_id::text,
        'project_id', p_project_id,
        'title', btrim(p_title),
        'summary', NULLIF(btrim(p_summary), ''),
        'demo_url', NULLIF(btrim(p_demo_url), ''),
        'repo_url', NULLIF(btrim(p_repo_url), ''),
        'slide_url', NULLIF(btrim(p_slide_url), ''),
        'video_url', NULLIF(btrim(p_video_url), ''),
        'logo_path', NULLIF(btrim(p_logo_path), ''),
        'screenshot_paths', to_jsonb(COALESCE(p_screenshot_paths, '{}'::text[])),
        'track_ids', COALESCE(p_track_ids, '{}'::text[]),
        'sector_ids', COALESCE(p_sector_ids, '{}'::text[]),
        'tech_stack_ids', COALESCE(p_tech_stack_ids, '{}'::text[]),
        'submitted_at', v_now,
        'updated_at', v_now
      )
    )
    ON CONFLICT (id) DO UPDATE SET
      project_id = EXCLUDED.project_id,
      document = (public.hackathon_submissions.document - 'cover_image_url' - 'screenshot_url') || EXCLUDED.document;
  END IF;

  RETURN QUERY SELECT p_project_id, v_submission_id, lower(btrim(p_slug));
END;
$$;

REVOKE ALL ON FUNCTION public.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
) TO service_role;

CREATE OR REPLACE FUNCTION public.save_ai_gated_project_locale(
  p_actor_id uuid,
  p_project_id uuid,
  p_locale text,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    LEFT JOIN public.profiles pr ON pr.id = p_actor_id
    WHERE p.id = p_project_id
      AND (p.owner_id = p_actor_id OR pr.role IN ('admin', 'support_staff'))
  ) THEN
    RAISE EXCEPTION 'forbidden:project_locale_update';
  END IF;
  IF p_locale NOT IN ('vi', 'en') THEN
    RAISE EXCEPTION 'invalid_input:locale';
  END IF;
  INSERT INTO public.project_locales (project_id, locale, data)
  VALUES (
    p_project_id,
    p_locale,
    jsonb_strip_nulls(jsonb_build_object(
      'title', NULLIF(btrim(p_data->>'title'), ''),
      'summary', NULLIF(btrim(p_data->>'summary'), ''),
      'updated_at', clock_timestamp()
    ))
  )
  ON CONFLICT (project_id, locale) DO UPDATE SET data = EXCLUDED.data;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ai_gated_project_i18n(
  p_actor_id uuid,
  p_project_id uuid,
  p_i18n jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.projects p
  SET i18n = p_i18n
  WHERE p.id = p_project_id
    AND (
      p.owner_id = p_actor_id
      OR EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = p_actor_id AND pr.role IN ('admin', 'support_staff')
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden:project_i18n_update';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  public.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  public.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  TO service_role;

-- Automatic course/submission mirrors would create project content outside the
-- AI gate, so project creation is now exclusively owned by projects.save.
DROP TRIGGER IF EXISTS trg_sync_project_from_final_assignment_submission
  ON public.final_assignment_submissions;
DROP FUNCTION IF EXISTS private.sync_project_from_final_assignment_submission();

-- Accepted collaborators are publicly attributable only when they opted into
-- portfolio visibility and the project itself is public/unlisted.
DROP POLICY IF EXISTS project_collaborators_select_visible
  ON public.project_collaborators;
CREATE POLICY project_collaborators_select_visible
  ON public.project_collaborators FOR SELECT
  TO anon, authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_project(project_id, (SELECT auth.uid()))
    OR (
      show_in_portfolio = true
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.visibility IN ('public', 'unlisted')
      )
    )
  );

-- A manager may invite or remove people, but cannot directly manufacture an
-- accepted membership. Only the invitee can create their own row from a live
-- pending invitation (the acceptance RPC performs the same check server-side).
DROP POLICY IF EXISTS project_collaborators_insert_visible
  ON public.project_collaborators;
CREATE POLICY project_collaborators_insert_visible
  ON public.project_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.project_collaboration_invites i
      WHERE i.project_id = project_collaborators.project_id
        AND i.invitee_user_id = (SELECT auth.uid())
        AND i.status = 'pending'
        AND i.expires_at > now()
    )
  );

-- Public media reads are limited to paths referenced by visible projects.
DROP POLICY IF EXISTS project_media_select ON storage.objects;
CREATE POLICY project_media_select
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'project-media'
    AND (
      (storage.foldername(name))[2] = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE (p.logo_path = name OR name = ANY(p.screenshot_paths))
          AND (
            p.visibility IN ('public', 'unlisted')
            OR p.owner_id = (SELECT auth.uid())
            OR private.is_project_collaborator(p.id, (SELECT auth.uid()))
          )
      )
    )
  );

-- Shared eligibility rule for project invitations. Hackathon projects retain
-- participant eligibility; other project sources may invite any public profile.
CREATE OR REPLACE FUNCTION private.is_project_team_candidate(
  p_project_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p.source_type IN ('contest', 'hackathon') THEN EXISTS (
      SELECT 1 FROM public.hackathon_registrations hr
      WHERE hr.hackathon_id = p.source_id
        AND hr.user_id = p_user_id
        AND hr.document->>'status' IN ('registered', 'approved')
    )
    ELSE EXISTS (SELECT 1 FROM public.public_profiles pp WHERE pp.id = p_user_id)
  END
  FROM public.projects p
  WHERE p.id = p_project_id;
$$;
REVOKE ALL ON FUNCTION private.is_project_team_candidate(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_project_collaboration_invite(
  p_project_id uuid,
  p_invitee_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_token text;
  v_hash text;
  v_invite_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '14 days';
  v_notif_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT p.owner_id INTO v_owner FROM public.projects p WHERE p.id = p_project_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF NOT private.can_manage_project(p_project_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_invitee_user_id = v_owner THEN RAISE EXCEPTION 'cannot_invite_owner'; END IF;
  IF NOT COALESCE(private.is_project_team_candidate(p_project_id, p_invitee_user_id), false) THEN
    RAISE EXCEPTION 'invitee_not_eligible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = p_project_id AND pc.user_id = p_invitee_user_id
  ) THEN RAISE EXCEPTION 'already_collaborator'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_collaboration_invites i
    WHERE i.project_id = p_project_id
      AND i.invitee_user_id = p_invitee_user_id
      AND i.status = 'pending' AND i.expires_at > now()
  ) THEN RAISE EXCEPTION 'pending_invite_exists'; END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.user_notifications (id, user_id, type, payload)
  VALUES (
    gen_random_uuid(), p_invitee_user_id, 'project_collaboration_invite',
    jsonb_build_object('invite_id', v_invite_id, 'project_id', p_project_id, 'invited_by', v_uid)
  ) RETURNING id INTO v_notif_id;
  INSERT INTO public.project_collaboration_invites (
    id, project_id, invitee_user_id, invited_by, status, token_hash, expires_at, notification_id
  ) VALUES (
    v_invite_id, p_project_id, p_invitee_user_id, v_uid, 'pending', v_hash, v_expires, v_notif_id
  );
  RETURN json_build_object('invite_id', v_invite_id, 'token', v_token, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_project_team_candidates(
  p_project_id uuid,
  p_source_type text,
  p_source_id text,
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q text := btrim(COALESCE(p_search, ''));
  v_source_type text := COALESCE(NULLIF(btrim(p_source_type), ''), 'standalone');
  v_source_id text := NULLIF(btrim(p_source_id), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id) THEN
    IF NOT private.can_manage_project(p_project_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT p.source_type, p.source_id INTO v_source_type, v_source_id
    FROM public.projects p WHERE p.id = p_project_id;
  ELSIF v_source_type IN ('contest', 'hackathon') AND NOT EXISTS (
    SELECT 1 FROM public.hackathon_registrations hr
    WHERE hr.hackathon_id = v_source_id AND hr.user_id = v_uid
      AND hr.document->>'status' IN ('registered', 'approved')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT pp.id, pp.username, pp.full_name, pp.avatar_url
  FROM public.public_profiles pp
  WHERE pp.id <> v_uid
    AND (
      v_source_type NOT IN ('contest', 'hackathon')
      OR EXISTS (
        SELECT 1 FROM public.hackathon_registrations hr
        WHERE hr.hackathon_id = v_source_id AND hr.user_id = pp.id
          AND hr.document->>'status' IN ('registered', 'approved')
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = p_project_id AND pc.user_id = pp.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.project_collaboration_invites i
      WHERE i.project_id = p_project_id AND i.invitee_user_id = pp.id
        AND i.status = 'pending' AND i.expires_at > now()
    )
    AND (
      v_q = '' OR pp.username ILIKE '%' || v_q || '%'
      OR pp.full_name ILIKE '%' || v_q || '%'
    )
  ORDER BY COALESCE(pp.full_name, pp.username, pp.id::text)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_project_collaboration_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.project_collaboration_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO r FROM public.project_collaboration_invites i WHERE i.id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF r.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_pending'; END IF;
  IF r.expires_at <= now() THEN
    UPDATE public.project_collaboration_invites SET status = 'expired', resolved_at = now() WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;
  IF NOT COALESCE(private.is_project_team_candidate(r.project_id, v_uid), false) THEN
    RAISE EXCEPTION 'invitee_not_eligible';
  END IF;
  INSERT INTO public.project_collaborators (project_id, user_id, role, show_in_portfolio)
  VALUES (r.project_id, v_uid, 'contributor', true)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  UPDATE public.project_collaboration_invites SET status = 'accepted', resolved_at = now() WHERE id = r.id;
  UPDATE public.user_notifications SET resolved_at = now() WHERE id = r.notification_id;
  RETURN json_build_object('ok', true, 'project_id', r.project_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_project_collaboration_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.project_collaboration_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(btrim(COALESCE(p_token, ''))) < 32 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  v_hash := encode(extensions.digest(convert_to(btrim(p_token), 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO r FROM public.project_collaboration_invites i WHERE i.token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF r.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_pending'; END IF;
  IF r.expires_at <= now() THEN
    UPDATE public.project_collaboration_invites SET status = 'expired', resolved_at = now() WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;
  IF NOT COALESCE(private.is_project_team_candidate(r.project_id, v_uid), false) THEN
    RAISE EXCEPTION 'invitee_not_eligible';
  END IF;
  INSERT INTO public.project_collaborators (project_id, user_id, role, show_in_portfolio)
  VALUES (r.project_id, v_uid, 'contributor', true)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  UPDATE public.project_collaboration_invites SET status = 'accepted', resolved_at = now() WHERE id = r.id;
  UPDATE public.user_notifications SET resolved_at = now() WHERE id = r.notification_id;
  RETURN json_build_object('ok', true, 'project_id', r.project_id);
END;
$$;

ALTER FUNCTION public.list_project_team_candidates(uuid, text, text, text, integer) SET SCHEMA private;
ALTER FUNCTION public.accept_project_collaboration_invite_by_id(uuid) SET SCHEMA private;
ALTER FUNCTION public.accept_project_collaboration_invite(text) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.list_project_team_candidates(uuid, text, text, text, integer),
  private.accept_project_collaboration_invite_by_id(uuid),
  private.accept_project_collaboration_invite(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.list_project_team_candidates(uuid, text, text, text, integer),
  private.accept_project_collaboration_invite_by_id(uuid),
  private.accept_project_collaboration_invite(text)
  TO authenticated;

CREATE FUNCTION public.list_project_team_candidates(
  p_project_id uuid,
  p_source_type text,
  p_source_id text,
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.list_project_team_candidates(
    p_project_id, p_source_type, p_source_id, p_search, p_limit
  );
$$;

CREATE FUNCTION public.accept_project_collaboration_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.accept_project_collaboration_invite_by_id(p_invite_id);
$$;

CREATE FUNCTION public.accept_project_collaboration_invite(p_token text)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.accept_project_collaboration_invite(p_token);
$$;

REVOKE ALL ON FUNCTION public.list_project_team_candidates(uuid, text, text, text, integer),
  public.accept_project_collaboration_invite_by_id(uuid),
  public.accept_project_collaboration_invite(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_project_team_candidates(uuid, text, text, text, integer),
  public.accept_project_collaboration_invite_by_id(uuid),
  public.accept_project_collaboration_invite(text)
  TO authenticated;

-- Keep the privileged AI-gated implementations outside the exposed schema;
-- the public service-role wrappers are the only PostgREST entry points.
ALTER FUNCTION public.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
) SET SCHEMA private;
ALTER FUNCTION public.save_ai_gated_project_locale(uuid, uuid, text, jsonb) SET SCHEMA private;
ALTER FUNCTION public.update_ai_gated_project_i18n(uuid, uuid, jsonb) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
), private.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  private.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
), private.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  private.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  TO service_role;

CREATE FUNCTION public.save_ai_gated_project(
  p_actor_id uuid,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_logo_path text DEFAULT NULL,
  p_screenshot_paths text[] DEFAULT '{}'::text[],
  p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'standalone',
  p_source_id text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}'::text[],
  p_sector_ids text[] DEFAULT '{}'::text[],
  p_tech_stack_ids text[] DEFAULT '{}'::text[]
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.save_ai_gated_project(
    p_actor_id, p_project_id, p_slug, p_title, p_summary, p_demo_url,
    p_repo_url, p_slide_url, p_video_url, p_logo_path, p_screenshot_paths,
    p_visibility, p_source_type, p_source_id, p_track_ids, p_sector_ids,
    p_tech_stack_ids
  );
$$;

CREATE FUNCTION public.save_ai_gated_project_locale(
  p_actor_id uuid,
  p_project_id uuid,
  p_locale text,
  p_data jsonb
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.save_ai_gated_project_locale(p_actor_id, p_project_id, p_locale, p_data);
$$;

CREATE FUNCTION public.update_ai_gated_project_i18n(
  p_actor_id uuid,
  p_project_id uuid,
  p_i18n jsonb
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.update_ai_gated_project_i18n(p_actor_id, p_project_id, p_i18n);
$$;

REVOKE ALL ON FUNCTION public.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
), public.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  public.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project(
  uuid, uuid, text, text, text, text, text, text, text, text, text[],
  text, text, text, text[], text[], text[]
), public.save_ai_gated_project_locale(uuid, uuid, text, jsonb),
  public.update_ai_gated_project_i18n(uuid, uuid, jsonb)
  TO service_role;
