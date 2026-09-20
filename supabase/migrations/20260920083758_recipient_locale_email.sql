-- Recipient locale is resolved once before delivery. Unknown values fall back to
-- English; this does not change the website's UI-language default.

CREATE OR REPLACE FUNCTION private.normalize_email_locale(p_locale text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(lower(replace(btrim(coalesce(p_locale, '')), '_', '-')), '-', 1) IN ('vi', 'vn') THEN 'vi'
    WHEN split_part(lower(replace(btrim(coalesce(p_locale, '')), '_', '-')), '-', 1) = 'en' THEN 'en'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.normalize_email_locale(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.email_contacts ALTER COLUMN locale SET DEFAULT 'en';

ALTER TABLE public.email_template_versions
  ADD COLUMN localized_content jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.email_campaign_recipients
  ADD COLUMN resolved_locale text CHECK (resolved_locale IN ('vi', 'en')),
  ADD COLUMN locale_source text CHECK (locale_source IN ('profile', 'auth_metadata', 'contact', 'fallback')),
  ADD COLUMN request_snapshot jsonb;

ALTER TABLE public.email_automations ADD COLUMN pause_reason text;

CREATE OR REPLACE FUNCTION private.email_localized_content_complete(p_content jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_content) = 'object'
    AND coalesce(nullif(btrim(p_content->'vi'->>'subject'), ''), '') <> ''
    AND coalesce(nullif(btrim(p_content->'vi'->>'body_text'), ''), '') <> ''
    AND coalesce(nullif(btrim(p_content->'en'->>'subject'), ''), '') <> ''
    AND coalesce(nullif(btrim(p_content->'en'->>'body_text'), ''), '') <> ''
$$;
REVOKE ALL ON FUNCTION private.email_localized_content_complete(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.email_require_published_translations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'published' AND NOT private.email_localized_content_complete(NEW.localized_content) THEN
    RAISE EXCEPTION 'email_template_translations_incomplete';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.email_require_published_translations() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_email_require_published_translations
BEFORE INSERT OR UPDATE OF status, localized_content ON public.email_template_versions
FOR EACH ROW EXECUTE FUNCTION private.email_require_published_translations();

UPDATE public.email_automations a
SET enabled = false, pause_reason = 'template_translations_incomplete', updated_at = now()
WHERE a.enabled AND EXISTS (
  SELECT 1 FROM public.email_automation_steps s
  JOIN public.email_template_versions v ON v.id = s.template_version_id
  WHERE s.automation_id = a.id AND NOT private.email_localized_content_complete(v.localized_content)
);

CREATE OR REPLACE FUNCTION private.email_resolve_campaign_recipient_locale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_profile_locale text;
  v_metadata_locale text;
  v_contact_locale text;
BEGIN
  SELECT c.user_id, c.locale INTO v_user_id, v_contact_locale
  FROM public.email_contacts c WHERE c.id = NEW.contact_id;

  IF v_user_id IS NOT NULL THEN
    SELECT p.locale, u.raw_user_meta_data->>'locale'
      INTO v_profile_locale, v_metadata_locale
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_user_id;
  END IF;

  IF private.normalize_email_locale(v_profile_locale) IS NOT NULL THEN
    NEW.resolved_locale := private.normalize_email_locale(v_profile_locale);
    NEW.locale_source := 'profile';
  ELSIF private.normalize_email_locale(v_metadata_locale) IS NOT NULL THEN
    NEW.resolved_locale := private.normalize_email_locale(v_metadata_locale);
    NEW.locale_source := 'auth_metadata';
  ELSIF private.normalize_email_locale(v_contact_locale) IS NOT NULL THEN
    NEW.resolved_locale := private.normalize_email_locale(v_contact_locale);
    NEW.locale_source := 'contact';
  ELSE
    NEW.resolved_locale := 'en';
    NEW.locale_source := 'fallback';
  END IF;
  NEW.personalization := coalesce(NEW.personalization, '{}'::jsonb)
    || jsonb_build_object('locale', NEW.resolved_locale);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.email_resolve_campaign_recipient_locale() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_email_resolve_campaign_recipient_locale
BEFORE INSERT ON public.email_campaign_recipients
FOR EACH ROW EXECUTE FUNCTION private.email_resolve_campaign_recipient_locale();

CREATE OR REPLACE FUNCTION private.sync_profile_locale_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_locale text;
BEGIN
  v_locale := coalesce(private.normalize_email_locale(NEW.locale), 'en');
  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('locale', v_locale),
      updated_at = now()
  WHERE id = NEW.id
    AND private.normalize_email_locale(raw_user_meta_data->>'locale') IS DISTINCT FROM v_locale;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_profile_locale_to_auth() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_profile_locale_to_auth
AFTER INSERT OR UPDATE OF locale ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.sync_profile_locale_to_auth();

-- Preserve every valid profile value. Only missing/invalid account data falls
-- back through Auth metadata and then English.
UPDATE public.profiles p
SET locale = coalesce(
  private.normalize_email_locale(p.locale),
  private.normalize_email_locale(u.raw_user_meta_data->>'locale'),
  'en'
)
FROM auth.users u
WHERE u.id = p.id
  AND private.normalize_email_locale(p.locale) IS NULL;

UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('locale', coalesce(private.normalize_email_locale(p.locale), private.normalize_email_locale(u.raw_user_meta_data->>'locale'), 'en')),
  updated_at = now()
FROM public.profiles p
WHERE p.id = u.id
  AND private.normalize_email_locale(u.raw_user_meta_data->>'locale') IS DISTINCT FROM
      coalesce(private.normalize_email_locale(p.locale), private.normalize_email_locale(u.raw_user_meta_data->>'locale'), 'en');

UPDATE public.email_contacts c
SET locale = CASE
  WHEN c.user_id IS NOT NULL THEN coalesce(private.normalize_email_locale(p.locale), private.normalize_email_locale(u.raw_user_meta_data->>'locale'), 'en')
  ELSE coalesce(private.normalize_email_locale(c.locale), 'en')
END,
updated_at = now()
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE c.user_id = u.id;

UPDATE public.email_contacts
SET locale = coalesce(private.normalize_email_locale(locale), 'en'), updated_at = now()
WHERE user_id IS NULL AND private.normalize_email_locale(locale) IS NULL;

CREATE OR REPLACE FUNCTION private.sync_email_contact_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_email text; v_full_name text; v_locale text; v_verified_at timestamptz; v_conflicting_user uuid;
BEGIN
  SELECT lower(btrim(u.email)), NULLIF(btrim(p.full_name), ''),
    coalesce(private.normalize_email_locale(p.locale), private.normalize_email_locale(u.raw_user_meta_data->>'locale'), 'en'),
    u.email_confirmed_at
  INTO v_email, v_full_name, v_locale, v_verified_at
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = p_user_id;
  IF NOT FOUND OR v_email IS NULL OR v_email = '' OR position('@' IN v_email) <= 1 OR position('.' IN split_part(v_email, '@', 2)) <= 1 THEN
    UPDATE public.email_contacts SET user_id = NULL, account_verified_at = NULL, updated_at = now() WHERE user_id = p_user_id;
    RETURN;
  END IF;
  SELECT user_id INTO v_conflicting_user FROM public.email_contacts WHERE email = v_email AND user_id IS NOT NULL AND user_id <> p_user_id;
  IF v_conflicting_user IS NOT NULL THEN RAISE EXCEPTION 'email_contact_sync_conflict:%', v_email; END IF;
  UPDATE public.email_contacts SET user_id = NULL, account_verified_at = NULL, updated_at = now() WHERE user_id = p_user_id AND email <> v_email;
  INSERT INTO public.email_contacts(user_id,email,full_name,locale,source_type,account_verified_at,metadata,updated_at)
  VALUES (p_user_id,v_email,v_full_name,v_locale,'corelia',v_verified_at,jsonb_build_object('source','corelia'),now())
  ON CONFLICT (email) DO UPDATE SET user_id=EXCLUDED.user_id,full_name=coalesce(EXCLUDED.full_name,public.email_contacts.full_name),
    locale=EXCLUDED.locale,source_type='corelia',account_verified_at=EXCLUDED.account_verified_at,
    metadata=public.email_contacts.metadata||jsonb_build_object('source','corelia'),updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION private.sync_email_contact_for_user(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.email_template_versions.localized_content IS
  'Immutable per-version vi/en content. Legacy columns mirror English during compatibility rollout.';
COMMENT ON COLUMN public.email_campaign_recipients.request_snapshot IS
  'Provider request frozen before first dispatch; retries must reuse it byte-for-byte.';

-- The first Auth email uses signup metadata. The account row then adopts the
-- same normalized locale, defaulting to English for OAuth/imported accounts.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_claimed_count int := 0;
BEGIN
  INSERT INTO public.profiles(id,role,locale,full_name,email,created_at,updated_at)
  VALUES (NEW.id,'student',coalesce(private.normalize_email_locale(NEW.raw_user_meta_data->>'locale'),'en'),
    coalesce(nullif(NEW.raw_user_meta_data->>'full_name',''),nullif(NEW.raw_user_meta_data->>'name',''),NULL),
    NEW.email,now(),now())
  ON CONFLICT (id) DO NOTHING;
  BEGIN
    IF NEW.email IS NOT NULL THEN
      INSERT INTO public.credential_issuances(template_id,user_id,course_id,hackathon_id,issuer_reference_id,network,status,error_message,granted_by,granted_reason)
      SELECT p.template_id,NEW.id,NULL,NULL,
        'ocv2:'||left(replace(t.id::text,'-',''),16)||':'||left(replace(NEW.id::text,'-',''),16),
        p.network,'pending','awaiting_holder_id',p.granted_by,p.granted_reason
      FROM public.pending_credential_issuances p JOIN public.credential_templates t ON t.id=p.template_id
      WHERE lower(p.email)=lower(btrim(NEW.email)) ON CONFLICT (issuer_reference_id,network) DO NOTHING;
      GET DIAGNOSTICS v_claimed_count = ROW_COUNT;
      IF v_claimed_count > 0 THEN UPDATE public.profiles SET pending_credentials_claimed_at=now() WHERE id=NEW.id; END IF;
      DELETE FROM public.pending_credential_issuances WHERE lower(email)=lower(btrim(NEW.email));
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
