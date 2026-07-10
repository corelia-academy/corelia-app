-- Ghost minting step 2: on signup, claim any pending_credential_issuances rows that
-- match the new account's email, converting them into real credential_issuances.
--
-- Safety notes (this repo's .agents/AGENTS.md records prior prod incidents from
-- careless trigger/migration edits — treat this file with the same caution):
--   * CREATE OR REPLACE targets the SAME name/schema (private.handle_new_user).
--     The existing `on_auth_user_created` trigger already points there, so it
--     picks up this new body automatically — no DROP TRIGGER / CREATE TRIGGER
--     statement in this file, nothing else is touched.
--   * The original public.profiles insert is preserved verbatim and still runs
--     first, unconditionally.
--   * The new logic is a pure DB write (no HTTP/network call), and is wrapped in
--     its own nested BEGIN/EXCEPTION block so a failure there (bad data, a
--     constraint violation, anything) can never abort the profiles insert or the
--     signup itself.
--   * SECURITY DEFINER / SET search_path = public kept character-for-character
--     identical to the function's current attributes.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, locale, full_name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    'student',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'vi'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULL
    ),
    NEW.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Isolated sub-block: claiming pending ghost-minted credentials must never be
  -- able to break account creation.
  DECLARE
    v_claimed_count int := 0;
  BEGIN
    IF NEW.email IS NOT NULL THEN
      -- issuer_reference_id must match issuerReferenceId() in
      -- supabase/functions/corelia-api/credentials/ids.ts exactly, so retries /
      -- future grants dedupe correctly against whatever gets created here.
      INSERT INTO public.credential_issuances (
        template_id, user_id, course_id, hackathon_id, issuer_reference_id, network,
        status, error_message, granted_by, granted_reason
      )
      SELECT
        p.template_id,
        NEW.id,
        NULL,
        NULL,
        t.identifier_prefix || ':' || replace(NEW.id::text, '-', ''),
        p.network,
        'pending',
        -- Matches the precondition mintCredentialOnce() checks before calling
        -- OpenCampus (mint.ts) — a brand-new account has no ocid/wallet yet, so
        -- credentials.retryPending picks these rows up automatically once the
        -- user connects their OCID. No HTTP call is made from this trigger.
        'awaiting_holder_id',
        p.granted_by,
        p.granted_reason
      FROM public.pending_credential_issuances p
      JOIN public.credential_templates t ON t.id = p.template_id
      WHERE lower(p.email) = lower(btrim(NEW.email))
      ON CONFLICT (issuer_reference_id, network) DO NOTHING;

      GET DIAGNOSTICS v_claimed_count = ROW_COUNT;

      IF v_claimed_count > 0 THEN
        UPDATE public.profiles
        SET pending_credentials_claimed_at = now()
        WHERE id = NEW.id;
      END IF;

      -- Remove staged rows for this email regardless of whether the INSERT above
      -- created new rows or hit ON CONFLICT DO NOTHING (an issuance already
      -- existing for this user+template means the pending row's job is done).
      DELETE FROM public.pending_credential_issuances
      WHERE lower(email) = lower(btrim(NEW.email));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
