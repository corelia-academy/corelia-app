-- Open Campus makes issuer_reference_id unique per issuer. The old
-- <identifier_prefix>:<user_id> format collided whenever two templates reused
-- the same prefix for the same learner. New rows use the same V2 format as
-- credentials/ids.ts: ocv2:<first-16-template-hex>:<first-16-user-hex>.

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

  -- Pending grants are inserted locally only. Minting remains deferred until
  -- the learner connects an OCID and credentials.retryPending runs.
  DECLARE
    v_claimed_count int := 0;
  BEGIN
    IF NEW.email IS NOT NULL THEN
      INSERT INTO public.credential_issuances (
        template_id, user_id, course_id, hackathon_id, issuer_reference_id, network,
        status, error_message, granted_by, granted_reason
      )
      SELECT
        p.template_id,
        NEW.id,
        NULL,
        NULL,
        'ocv2:' || left(replace(t.id::text, '-', ''), 16) || ':' || left(replace(NEW.id::text, '-', ''), 16),
        p.network,
        'pending',
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

      DELETE FROM public.pending_credential_issuances
      WHERE lower(email) = lower(btrim(NEW.email));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
