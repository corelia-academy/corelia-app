-- Repair the metrics snapshot RPC after hackathon access invites were retired.
-- The implementation was moved to private in 20260828060630, then its invite
-- helper was removed in 20260901093558 without updating this function body.

CREATE OR REPLACE FUNCTION private.patch_hackathon_metrics_snapshot(
  p_hackathon_id text,
  p_metrics_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created_by text;
  v_new_doc jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized:authentication_required';
  END IF;

  SELECT h.document->>'created_by'
  INTO v_created_by
  FROM public.hackathons h
  WHERE h.id = p_hackathon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found:hackathon';
  END IF;

  IF NOT public.is_admin_or_support() AND v_created_by IS DISTINCT FROM v_uid::text THEN
    RAISE EXCEPTION 'unauthorized:insufficient_permissions';
  END IF;

  UPDATE public.hackathons h
  SET
    document = jsonb_set(
      COALESCE(h.document, '{}'::jsonb),
      '{metrics_snapshot}',
      COALESCE(p_metrics_snapshot, '{}'::jsonb),
      true
    ),
    updated_at = now()
  WHERE h.id = p_hackathon_id
  RETURNING h.document INTO v_new_doc;

  RETURN v_new_doc->'metrics_snapshot';
END;
$$;

REVOKE ALL ON FUNCTION private.patch_hackathon_metrics_snapshot(text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.patch_hackathon_metrics_snapshot(text, jsonb)
  TO authenticated, service_role;
