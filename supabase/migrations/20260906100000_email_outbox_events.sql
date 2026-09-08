-- Transactional Outbox for application-generated emails (V-01, V-02, V-03).
-- Service-role only; protected from client read/write by Row Level Security.
CREATE TABLE public.email_outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sending', 'accepted', 'failed', 'indeterminate')),
  request_payload jsonb NOT NULL,
  provider_message_id text,
  lease_acquired_at timestamptz,
  lease_token uuid,
  last_attempt_at timestamptz,
  first_dispatched_at timestamptz,
  reconciled_at timestamptz,
  reconciled_by text,
  reconcile_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_outbox_events_status_idx
  ON public.email_outbox_events (status);

CREATE INDEX email_outbox_events_type_created_idx
  ON public.email_outbox_events (event_type, created_at DESC);

ALTER TABLE public.email_outbox_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_outbox_events IS
  'Authoritative transactional outbox for idempotent email delivery. Service-role only.';

-- S3: Prepare durable email outbox event in the same transaction as invite creation.
-- Security definer implementation remains private; public invoker wrapper is untouched.
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

  -- S3: Prepare durable outbox event with plaintext token before returning to client
  INSERT INTO public.email_outbox_events (
    idempotency_key, event_type, recipient_email, status, request_payload
  ) VALUES (
    v_invite_id::text, 'project_collaboration_invite', '', 'pending',
    jsonb_build_object('token', v_token, 'prepared', true)
  );

  RETURN json_build_object('invite_id', v_invite_id, 'token', v_token, 'expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION private.create_project_collaboration_invite(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_project_collaboration_invite(uuid, uuid) TO authenticated, service_role;
