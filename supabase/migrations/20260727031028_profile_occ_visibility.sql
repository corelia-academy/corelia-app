-- Owners explicitly choose which resolved Open Campus credentials appear on
-- their public profile. This is presentation state, separate from immutable
-- issuance snapshots and the mint lifecycle.
ALTER TABLE public.credential_issuances
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS credential_issuances_public_profile_idx
  ON public.credential_issuances (user_id, minted_at DESC)
  WHERE status = 'minted'
    AND show_on_profile = true
    AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL;

-- Replace the broad public read introduced for public profiles. An issuance is
-- now public only after its owner has selected it and its OC identifier is
-- resolved, so pending/reconciliation rows cannot leak to anonymous viewers.
DROP POLICY IF EXISTS credential_issuances_select_public_minted
  ON public.credential_issuances;
DROP POLICY IF EXISTS credential_issuances_select_public_profile
  ON public.credential_issuances;
CREATE POLICY credential_issuances_select_public_profile
  ON public.credential_issuances FOR SELECT
  TO anon, authenticated
  USING (
    status = 'minted'
    AND show_on_profile = true
    AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL
  );

-- Public profile cards embed a small credential-template summary. Keep that
-- metadata readable only when at least one corresponding issuance is selected.
DROP POLICY IF EXISTS credential_templates_select_public_profile
  ON public.credential_templates;
CREATE POLICY credential_templates_select_public_profile
  ON public.credential_templates FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.template_id = credential_templates.id
        AND ci.status = 'minted'
        AND ci.show_on_profile = true
        AND NULLIF(btrim(ci.oc_credential_id), '') IS NOT NULL
    )
  );

-- A credential issuance remains client read-only except for this single
-- presentation column. The policy and column grant let a SECURITY INVOKER RPC
-- update the owner's resolved credentials atomically without exposing mint
-- fields such as status, OC response, or issuer references.
REVOKE UPDATE ON TABLE public.credential_issuances FROM anon, authenticated;
GRANT UPDATE (show_on_profile) ON TABLE public.credential_issuances TO authenticated;

DROP POLICY IF EXISTS credential_issuances_update_profile_visibility
  ON public.credential_issuances;
CREATE POLICY credential_issuances_update_profile_visibility
  ON public.credential_issuances FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND status = 'minted'
    AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'minted'
    AND NULLIF(btrim(oc_credential_id), '') IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.set_my_profile_credential_visibility(
  p_issuance_ids uuid[]
)
RETURNS TABLE (issuance_id uuid, show_on_profile boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_requested_ids uuid[] := COALESCE(p_issuance_ids, ARRAY[]::uuid[]);
  v_invalid_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF cardinality(v_requested_ids) <> (
    SELECT count(DISTINCT requested_id)
    FROM unnest(v_requested_ids) AS requested(requested_id)
  ) THEN
    RAISE EXCEPTION 'duplicate_credential_issuance_id';
  END IF;

  SELECT count(*)
  INTO v_invalid_count
  FROM unnest(v_requested_ids) AS requested(requested_id)
  LEFT JOIN public.credential_issuances ci
    ON ci.id = requested.requested_id
  WHERE ci.id IS NULL
    OR ci.user_id <> v_user_id
    OR ci.status <> 'minted'
    OR NULLIF(btrim(ci.oc_credential_id), '') IS NULL;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'invalid_profile_credential_visibility_ids';
  END IF;

  UPDATE public.credential_issuances ci
  SET show_on_profile = ci.id = ANY(v_requested_ids)
  WHERE ci.user_id = v_user_id
    AND ci.status = 'minted'
    AND NULLIF(btrim(ci.oc_credential_id), '') IS NOT NULL;

  RETURN QUERY
  SELECT ci.id, ci.show_on_profile
  FROM public.credential_issuances ci
  WHERE ci.user_id = v_user_id
    AND ci.status = 'minted'
    AND NULLIF(btrim(ci.oc_credential_id), '') IS NOT NULL
  ORDER BY ci.minted_at DESC NULLS LAST, ci.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_my_profile_credential_visibility(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_profile_credential_visibility(uuid[])
  TO authenticated;
