-- Preserve incident evidence before repairing names. Never expose raw payloads.
CREATE TABLE private.profile_name_recovery (
  profile_id uuid PRIMARY KEY,
  original_name text,
  recovered_name text,
  recovery_source text NOT NULL,
  original_updated_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.profile_name_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.profile_name_recovery FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.normalize_profile_name(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT nullif(btrim(regexp_replace(regexp_replace(normalize(value, NFC),
   U&'[\0001-\001F\007F-\009F\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200E\200F\202A-\202E\2060-\206F\3164\FEFF\FFA0\FFF0-\FFFF]', '', 'g'),
   '[[:space:]' || chr(160) || U&'\2028\2029' || ']+', ' ', 'g')), '');
$$;
REVOKE ALL ON FUNCTION private.normalize_profile_name(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.valid_profile_name(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT value IS NULL OR coalesce((
   char_length(value) BETWEEN 1 AND 160
   AND value = private.normalize_profile_name(value)
   AND nullif(btrim(translate(value, U&'\200C\200D', '')), '') IS NOT NULL
 ), false);
$$;
REVOKE ALL ON FUNCTION private.valid_profile_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.valid_profile_name(text), private.normalize_profile_name(text) TO authenticated, service_role;

INSERT INTO private.profile_name_recovery (profile_id, original_name, recovered_name, recovery_source, original_updated_at)
SELECT p.id, p.full_name,
  CASE WHEN private.valid_profile_name(clean.name) AND clean.name IS NOT NULL THEN clean.name
       WHEN private.valid_profile_name(meta.name) AND meta.name IS NOT NULL THEN meta.name
       ELSE NULL END,
  CASE WHEN private.valid_profile_name(clean.name) AND clean.name IS NOT NULL THEN 'stripped_original'
       WHEN private.valid_profile_name(meta.name) AND meta.name IS NOT NULL THEN 'auth_metadata'
       ELSE 'unrecoverable' END,
  p.updated_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
CROSS JOIN LATERAL (SELECT private.normalize_profile_name(p.full_name) name) clean
CROSS JOIN LATERAL (SELECT coalesce(private.normalize_profile_name(u.raw_user_meta_data->>'full_name'),
                                   private.normalize_profile_name(u.raw_user_meta_data->>'name')) name) meta
WHERE NOT coalesce(private.valid_profile_name(p.full_name), false);

UPDATE public.profiles p SET full_name = r.recovered_name, updated_at = now()
FROM private.profile_name_recovery r WHERE p.id = r.profile_id;
-- Repair the public mirror even if historical data drifted from its source.
UPDATE public.public_profiles pp SET full_name = p.full_name
FROM public.profiles p WHERE p.id = pp.id AND pp.full_name IS DISTINCT FROM p.full_name;

ALTER TABLE public.profiles ADD CONSTRAINT profile_name_integrity CHECK (private.valid_profile_name(full_name));
ALTER TABLE public.public_profiles ADD CONSTRAINT public_profile_name_integrity CHECK (private.valid_profile_name(full_name));

-- Metadata from signup is untrusted; normalize/cap it without breaking signup.
CREATE FUNCTION private.prepare_profile_name_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.full_name := left(private.normalize_profile_name(NEW.full_name), 160);
 IF NOT coalesce(private.valid_profile_name(NEW.full_name), false) THEN NEW.full_name := NULL; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.prepare_profile_name_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prepare_profile_name_insert BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.prepare_profile_name_insert();

CREATE TABLE private.profile_name_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 profile_id uuid NOT NULL,
 actor_id uuid,
 old_name text,
 new_name text,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.profile_name_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.profile_name_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE private.profile_name_audit_id_seq FROM PUBLIC, anon, authenticated;
CREATE FUNCTION private.audit_profile_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
  INSERT INTO private.profile_name_audit(profile_id, actor_id, old_name, new_name)
  VALUES (NEW.id, auth.uid(), OLD.full_name, NEW.full_name);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_profile_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_profile_name AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.audit_profile_name();

-- Protect initial INSERT as well as UPDATE. A missing JWT is not by itself
-- evidence of a privileged caller (anon/authenticated can have no subject).
CREATE OR REPLACE FUNCTION private.guard_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid uuid := auth.uid();
 v_privileged boolean := coalesce(private.is_admin_or_support(), false) OR
   (v_uid IS NULL AND coalesce(current_setting('role', true), '') NOT IN ('anon', 'authenticated')
     AND (session_user IN ('postgres', 'supabase_admin') OR current_setting('role', true) = 'service_role'));
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NOT v_privileged THEN
   NEW.role := 'student';
   NEW.tier := 'free';
  END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'profile_identity_immutable' USING ERRCODE = '23514'; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.tier IS DISTINCT FROM OLD.tier THEN
   INSERT INTO private.profile_privilege_audit(target_id, actor_id, old_role, new_role, old_tier, new_tier, was_admin_caller, blocked)
   VALUES (OLD.id, v_uid, OLD.role, NEW.role, OLD.tier, NEW.tier, v_privileged, NOT v_privileged);
  END IF;
  IF NOT v_privileged THEN NEW.role := OLD.role; NEW.tier := OLD.tier; END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_privileged_columns();
REVOKE ALL ON FUNCTION private.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.profiles FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_profiles FROM anon, authenticated;
-- Reconcile historical policy names across clean recreations and live state.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
  EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
 END LOOP;
END $$;
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_select_self_or_staff ON public.profiles FOR SELECT TO authenticated
 USING (id = (SELECT auth.uid()) OR private.is_admin_or_support());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
 USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update_staff ON public.profiles FOR UPDATE TO authenticated
 USING (private.is_admin_or_support()) WITH CHECK (private.is_admin_or_support());

-- Additional copies discovered during incident review; preserve exact evidence.
CREATE TABLE private.profile_field_recovery (
 source_table text NOT NULL,
 record_id uuid NOT NULL,
 field_name text NOT NULL,
 original_value text,
 recovered_value text,
 captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_table, record_id, field_name)
);
ALTER TABLE private.profile_field_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.profile_field_recovery FROM PUBLIC, anon, authenticated;
INSERT INTO private.profile_field_recovery(source_table,record_id,field_name,original_value,recovered_value)
SELECT 'profiles', p.id, f.key, f.value, nullif(btrim(replace(f.value,chr(65526),'')),'')
FROM public.profiles p CROSS JOIN LATERAL jsonb_each_text(jsonb_build_object('username',p.username,'bio',p.bio)) f
WHERE strpos(f.value,chr(65526))>0;
UPDATE public.profiles p SET username=r.recovered_value, updated_at=now()
FROM private.profile_field_recovery r WHERE r.source_table='profiles' AND r.field_name='username' AND r.record_id=p.id;
UPDATE public.profiles p SET bio=r.recovered_value, updated_at=now()
FROM private.profile_field_recovery r WHERE r.source_table='profiles' AND r.field_name='bio' AND r.record_id=p.id;
INSERT INTO private.profile_field_recovery(source_table,record_id,field_name,original_value,recovered_value)
SELECT 'certificate_records', c.id, 'holder_name', c.holder_name,
 coalesce(private.normalize_profile_name(replace(c.holder_name,chr(65526),'')), p.full_name)
FROM public.certificate_records c LEFT JOIN public.profiles p ON p.id=c.user_id
WHERE strpos(c.holder_name,chr(65526))>0;
UPDATE public.certificate_records c SET holder_name=r.recovered_value
FROM private.profile_field_recovery r WHERE r.source_table='certificate_records' AND r.record_id=c.id;

-- Apply a payload ceiling to every profile text field, including future ones.
-- Multiline biography text remains valid; reserved Unicode payloads do not.
CREATE FUNCTION private.guard_profile_text_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE f record;
BEGIN
 FOR f IN SELECT key,value FROM jsonb_each_text(to_jsonb(NEW)) LOOP
  IF char_length(f.value)>16384 OR f.value ~ U&'[\0001-\0008\000B\000C\000E-\001F\007F-\009F\00AD\034F\061C\115F\1160\17B4\17B5\180E\200B\200E\200F\202A-\202E\2060-\206F\3164\FEFF\FFA0\FFF0-\FFFF]' THEN
   RAISE EXCEPTION 'profile_text_invalid:%', f.key USING ERRCODE='23514';
  END IF;
 END LOOP;
 IF char_length(NEW.username)>160 THEN RAISE EXCEPTION 'profile_username_too_long' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_text_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_guard_profile_text_fields BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_text_fields();
