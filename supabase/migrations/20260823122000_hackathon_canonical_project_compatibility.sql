-- C-09: `hackathon` is the canonical new project provenance value.
-- Keep `contest` readable/writable only for legacy compatibility; no legacy data is rewritten here.

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_source_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_source_type_check
  CHECK (source_type IN ('standalone', 'contest', 'hackathon', 'course'));

CREATE OR REPLACE FUNCTION private.sync_project_from_hackathon_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_summary text;
  v_demo text;
  v_repo text;
  v_slide text;
  v_screenshot text;
  v_cover text;
  v_video text;
  v_hackathon_id text;
BEGIN
  v_hackathon_id := NEW.hackathon_id::text;
  v_title := COALESCE(NULLIF(NEW.document->>'title', ''), 'Hackathon submission');
  v_summary := NULLIF(NEW.document->>'summary', '');
  v_demo := NULLIF(NEW.document->>'demo_url', '');
  v_repo := NULLIF(NEW.document->>'repo_url', '');
  v_slide := NULLIF(NEW.document->>'slide_url', '');
  v_screenshot := NULLIF(NEW.document->>'screenshot_url', '');
  v_cover := COALESCE(NULLIF(NEW.document->>'cover_image_url', ''), v_screenshot);
  v_video := NULLIF(NEW.document->>'video_url', '');

  -- A historical `contest` project is the same submission under the legacy
  -- vocabulary. Do not create a second project when that submission is updated.
  IF EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.owner_id = NEW.user_id
      AND p.source_submission_id = NEW.id
      AND p.source_type = 'contest'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.projects (
    owner_id, title, summary, demo_url, repo_url, slide_url,
    screenshot_url, cover_image_url, video_url, visibility,
    source_type, source_id, source_submission_id
  )
  VALUES (
    NEW.user_id, v_title, v_summary, v_demo, v_repo, v_slide,
    v_screenshot, v_cover, v_video, 'public',
    'hackathon', v_hackathon_id, NEW.id
  )
  ON CONFLICT (owner_id, source_type, source_submission_id)
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_from_hackathon_submission ON public.hackathon_submissions;
CREATE TRIGGER trg_sync_project_from_hackathon_submission
AFTER INSERT OR UPDATE ON public.hackathon_submissions
FOR EACH ROW
EXECUTE FUNCTION private.sync_project_from_hackathon_submission();

CREATE OR REPLACE FUNCTION public.create_project_collaboration_invite(
  p_project_id uuid,
  p_invitee_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_source_type text;
  v_hackathon_id text;
  v_reg_ok boolean;
  v_token text;
  v_hash text;
  v_invite_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '14 days';
  v_notif_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT p.owner_id, p.source_type, p.source_id
  INTO v_owner, v_source_type, v_hackathon_id
  FROM public.projects p WHERE p.id = p_project_id;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_owner <> v_uid AND NOT public.is_admin_or_support() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_source_type NOT IN ('contest', 'hackathon') THEN RAISE EXCEPTION 'only_hackathon_projects'; END IF;
  IF p_invitee_user_id = v_owner THEN RAISE EXCEPTION 'cannot_invite_owner'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.hackathon_registrations hr
    WHERE hr.hackathon_id = v_hackathon_id
      AND hr.user_id = p_invitee_user_id
      AND hr.document->>'status' = 'approved'
  ) INTO v_reg_ok;
  IF NOT v_reg_ok THEN RAISE EXCEPTION 'invitee_not_approved'; END IF;

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

REVOKE ALL ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_invitable_hackathon_users(
  p_project_id uuid,
  p_search text DEFAULT '',
  p_limit int DEFAULT 50
)
RETURNS TABLE (user_id uuid, username text, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hackathon_id text;
  v_q text := trim(coalesce(p_search, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.can_manage_project(p_project_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT p.source_id INTO v_hackathon_id
  FROM public.projects p
  WHERE p.id = p_project_id AND p.source_type IN ('contest', 'hackathon');
  IF v_hackathon_id IS NULL THEN RAISE EXCEPTION 'invalid_project'; END IF;

  RETURN QUERY
  SELECT hr.user_id, pp.username, pp.full_name, pp.avatar_url
  FROM public.hackathon_registrations hr
  LEFT JOIN public.public_profiles pp ON pp.id = hr.user_id
  WHERE hr.hackathon_id = v_hackathon_id
    AND hr.document->>'status' = 'approved'
    AND hr.user_id IS DISTINCT FROM (SELECT p2.owner_id FROM public.projects p2 WHERE p2.id = p_project_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = p_project_id AND pc.user_id = hr.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.project_collaboration_invites i
      WHERE i.project_id = p_project_id AND i.invitee_user_id = hr.user_id
        AND i.status = 'pending' AND i.expires_at > now()
    )
    AND (v_q = '' OR pp.username ILIKE '%' || v_q || '%' OR pp.full_name ILIKE '%' || v_q || '%' OR hr.user_id::text ILIKE '%' || v_q || '%')
  ORDER BY COALESCE(pp.full_name, pp.username, hr.user_id::text)
  LIMIT LEAST(coalesce(p_limit, 50), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.list_invitable_hackathon_users(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_invitable_hackathon_users(uuid, text, int) TO authenticated;
