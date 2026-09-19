-- Issue #500: count successful translations, not provider failures.
-- Reservations are short-lived so a crashed Edge invocation cannot hold a slot
-- for the full rolling-hour window.

ALTER TABLE private.project_translation_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'committed',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.project_translation_requests'::regclass
      AND conname = 'project_translation_requests_status_check'
  ) THEN
    ALTER TABLE private.project_translation_requests
      ADD CONSTRAINT project_translation_requests_status_check
      CHECK (status IN ('reserved','committed'));
  END IF;
END;
$constraint$;

-- Rows written by the previous attempt-based implementation remain committed
-- for their original rolling-hour window during the upgrade.
UPDATE private.project_translation_requests
SET status = 'committed', expires_at = NULL
WHERE status IS NULL OR status = 'committed';

CREATE INDEX IF NOT EXISTS project_translation_requests_active_window
  ON private.project_translation_requests(actor_id,created_at,status,expires_at);
GRANT UPDATE ON private.project_translation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_project_translation_success(p_actor_id uuid,p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_now timestamptz := clock_timestamp();
  v_used bigint;
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_identity';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id=p_project_id) THEN
    PERFORM private.assert_project_content_editable(p_actor_id,p_project_id);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('project-translate-success:' || p_actor_id::text,0)
  );

  DELETE FROM private.project_translation_requests
  WHERE actor_id=p_actor_id
    AND ((status='committed' AND created_at <= v_now-interval '1 hour')
      OR (status='reserved' AND (expires_at <= v_now OR created_at <= v_now-interval '1 hour')));

  SELECT count(*) INTO v_used
  FROM private.project_translation_requests
  WHERE actor_id=p_actor_id
    AND ((status='committed' AND created_at > v_now-interval '1 hour')
      OR (status='reserved' AND expires_at > v_now));
  IF v_used >= 10 THEN
    RAISE EXCEPTION 'rate_limited:project_translation';
  END IF;

  INSERT INTO private.project_translation_requests(actor_id,created_at,status,expires_at)
  VALUES(p_actor_id,v_now,'reserved',v_now+interval '15 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_project_translation(p_actor_id uuid,p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_status text;
  v_expires_at timestamptz;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_translation_reservation';
  END IF;
  SELECT status,expires_at INTO v_status,v_expires_at
  FROM private.project_translation_requests
  WHERE id=p_request_id AND actor_id=p_actor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input:project_translation_reservation';
  END IF;
  IF v_status='committed' THEN RETURN; END IF;
  IF v_expires_at IS NULL OR v_expires_at <= clock_timestamp() THEN
    DELETE FROM private.project_translation_requests WHERE id=p_request_id AND actor_id=p_actor_id;
    RAISE EXCEPTION 'conflict:project_translation_reservation_expired';
  END IF;
  UPDATE private.project_translation_requests
  SET status='committed',expires_at=NULL
  WHERE id=p_request_id AND actor_id=p_actor_id AND status='reserved';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_project_translation(p_actor_id uuid,p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_translation_reservation';
  END IF;
  DELETE FROM private.project_translation_requests
  WHERE id=p_request_id AND actor_id=p_actor_id AND status='reserved';
END;
$$;

-- Moderation blocks do not consume the successful-translation quota, but they
-- still have a separate guard against repeated policy-violating submissions.
CREATE TABLE IF NOT EXISTS private.project_translation_moderation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS project_translation_moderation_blocks_actor_time
  ON private.project_translation_moderation_blocks(actor_id,created_at);
ALTER TABLE private.project_translation_moderation_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_translation_moderation_blocks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON private.project_translation_moderation_blocks TO service_role;

CREATE OR REPLACE FUNCTION public.assert_project_translation_moderation_allowed(p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_count bigint;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'invalid_input:project_identity'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('project-translate-moderation:' || p_actor_id::text,0)
  );
  DELETE FROM private.project_translation_moderation_blocks
  WHERE actor_id=p_actor_id AND created_at <= v_now-interval '1 hour';
  SELECT count(*) INTO v_count
  FROM private.project_translation_moderation_blocks
  WHERE actor_id=p_actor_id AND created_at > v_now-interval '1 hour';
  IF v_count >= 10 THEN RAISE EXCEPTION 'rate_limited:project_translation_moderation'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_project_translation_moderation_block(p_actor_id uuid,p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_count bigint;
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_identity';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('project-translate-moderation:' || p_actor_id::text,0)
  );
  DELETE FROM private.project_translation_moderation_blocks
  WHERE actor_id=p_actor_id AND created_at <= v_now-interval '1 hour';
  SELECT count(*) INTO v_count
  FROM private.project_translation_moderation_blocks
  WHERE actor_id=p_actor_id AND created_at > v_now-interval '1 hour';
  IF v_count >= 10 THEN RAISE EXCEPTION 'rate_limited:project_translation_moderation'; END IF;
  INSERT INTO private.project_translation_moderation_blocks(actor_id,project_id,created_at)
  VALUES(p_actor_id,p_project_id,v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_project_translation_success(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.commit_project_translation(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_project_translation(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.assert_project_translation_moderation_allowed(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_project_translation_moderation_block(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_project_translation_success(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_project_translation(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_project_translation(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_project_translation_moderation_allowed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_project_translation_moderation_block(uuid,uuid) TO service_role;
