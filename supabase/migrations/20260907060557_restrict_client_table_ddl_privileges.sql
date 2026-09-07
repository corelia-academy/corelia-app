-- Browser CRUD is governed by RLS. Browser roles never need table DDL or
-- TRUNCATE (which is not filtered by RLS) on application tables.
-- Supabase-managed Storage relations are owned by supabase_storage_admin and
-- are outside this migration role: leave their provider-managed ACLs intact.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;

-- instructor_origin participates in credential authorization and must be
-- protected just like role/tier, not editable by an external instructor.
ALTER TABLE private.profile_privilege_audit ADD COLUMN old_instructor_origin text;
ALTER TABLE private.profile_privilege_audit ADD COLUMN new_instructor_origin text;
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
   NEW.role := 'student'; NEW.tier := 'free'; NEW.instructor_origin := NULL;
  END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'profile_identity_immutable' USING ERRCODE = '23514'; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.instructor_origin IS DISTINCT FROM OLD.instructor_origin THEN
   INSERT INTO private.profile_privilege_audit(target_id, actor_id, old_role, new_role, old_tier, new_tier,
     was_admin_caller, blocked, old_instructor_origin, new_instructor_origin)
   VALUES (OLD.id, v_uid, OLD.role, NEW.role, OLD.tier, NEW.tier, v_privileged, NOT v_privileged,
     OLD.instructor_origin, NEW.instructor_origin);
  END IF;
  IF NOT v_privileged THEN
   NEW.role := OLD.role; NEW.tier := OLD.tier; NEW.instructor_origin := OLD.instructor_origin;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
