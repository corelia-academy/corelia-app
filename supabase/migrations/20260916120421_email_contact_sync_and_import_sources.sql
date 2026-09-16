-- Keep Email Center contacts in sync with Corelia accounts and record CSV origin.

ALTER TABLE public.email_contacts
  ADD COLUMN account_verified_at timestamptz,
  ADD COLUMN marketing_status text NOT NULL DEFAULT 'none'
    CHECK (marketing_status IN ('none', 'subscribed', 'unsubscribed')),
  ADD COLUMN source_type text NOT NULL DEFAULT 'csv'
    CHECK (source_type IN ('corelia', 'csv', 'luma'));

ALTER TABLE public.email_import_jobs
  ADD COLUMN source_type text NOT NULL DEFAULT 'csv'
    CHECK (source_type IN ('csv', 'luma'));

ALTER TABLE public.email_lists DROP CONSTRAINT email_lists_source_type_check;
ALTER TABLE public.email_lists
  ADD CONSTRAINT email_lists_source_type_check
  CHECK (source_type IN ('import','luma','course','program','hackathon','manual'));

CREATE INDEX email_contacts_source_idx ON public.email_contacts(source_type, created_at DESC);
CREATE INDEX email_contacts_verified_idx ON public.email_contacts(account_verified_at) WHERE user_id IS NOT NULL;
CREATE INDEX email_contacts_marketing_idx ON public.email_contacts(marketing_status, created_at DESC);

UPDATE public.email_contacts c
SET marketing_status = cc.status
FROM public.email_contact_consents cc
WHERE cc.contact_id = c.id AND cc.topic = 'marketing';

CREATE OR REPLACE FUNCTION private.email_sync_marketing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.topic = 'marketing' THEN
      UPDATE public.email_contacts SET marketing_status = 'none', updated_at = now() WHERE id = OLD.contact_id;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.topic = 'marketing' THEN
    UPDATE public.email_contacts SET marketing_status = NEW.status, updated_at = now() WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.email_sync_marketing_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_sync_marketing_status ON public.email_contact_consents;
CREATE TRIGGER trg_email_sync_marketing_status
AFTER INSERT OR UPDATE OF status, topic OR DELETE ON public.email_contact_consents
FOR EACH ROW EXECUTE FUNCTION private.email_sync_marketing_status();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'email_contact_sync_duplicate_auth_emails';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.sync_email_contact_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_full_name text;
  v_locale text;
  v_verified_at timestamptz;
  v_conflicting_user uuid;
BEGIN
  SELECT lower(btrim(u.email)), NULLIF(btrim(p.full_name), ''),
         CASE WHEN p.locale = 'en' THEN 'en' ELSE 'vi' END,
         u.email_confirmed_at
  INTO v_email, v_full_name, v_locale, v_verified_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;

  IF NOT FOUND OR v_email IS NULL OR v_email = ''
     OR position('@' IN v_email) <= 1
     OR position('.' IN split_part(v_email, '@', 2)) <= 1 THEN
    UPDATE public.email_contacts
    SET user_id = NULL, account_verified_at = NULL, updated_at = now()
    WHERE user_id = p_user_id;
    RETURN;
  END IF;

  SELECT user_id INTO v_conflicting_user
  FROM public.email_contacts
  WHERE email = v_email AND user_id IS NOT NULL AND user_id <> p_user_id;
  IF v_conflicting_user IS NOT NULL THEN
    RAISE EXCEPTION 'email_contact_sync_conflict:%', v_email;
  END IF;

  -- Preserve the old address and all of its consent/suppression history.
  UPDATE public.email_contacts
  SET user_id = NULL, account_verified_at = NULL, updated_at = now()
  WHERE user_id = p_user_id AND email <> v_email;

  INSERT INTO public.email_contacts(
    user_id, email, full_name, locale, source_type, account_verified_at, metadata, updated_at
  ) VALUES (
    p_user_id, v_email, v_full_name, coalesce(v_locale, 'vi'), 'corelia', v_verified_at,
    jsonb_build_object('source', 'corelia'), now()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    full_name = coalesce(EXCLUDED.full_name, public.email_contacts.full_name),
    locale = EXCLUDED.locale,
    source_type = 'corelia',
    account_verified_at = EXCLUDED.account_verified_at,
    metadata = public.email_contacts.metadata || jsonb_build_object('source', 'corelia'),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION private.sync_email_contact_for_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.email_sync_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.sync_email_contact_for_user(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.email_sync_auth_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.email_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.sync_email_contact_for_user(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.email_sync_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_sync_auth_user ON auth.users;
CREATE TRIGGER trg_email_sync_auth_user
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.email_sync_auth_user();

DROP TRIGGER IF EXISTS trg_email_sync_profile ON public.profiles;
CREATE TRIGGER trg_email_sync_profile
AFTER INSERT OR UPDATE OF full_name, locale ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.email_sync_profile();

-- Idempotent backfill. It only creates/links contacts and never enrolls automation.
DO $$
DECLARE v_user record;
BEGIN
  FOR v_user IN
    SELECT id FROM auth.users WHERE email IS NOT NULL AND btrim(email) <> '' ORDER BY created_at, id
  LOOP
    PERFORM private.sync_email_contact_for_user(v_user.id);
  END LOOP;
END $$;
