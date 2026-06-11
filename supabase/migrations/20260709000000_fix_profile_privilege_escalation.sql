-- SECURITY HOTFIX: privilege escalation via self-update of public.profiles.
--
-- Root cause: policy `profiles_update_self_or_staff` permits a row update when
--   id = auth.uid() OR public.is_admin_or_support()
-- with no column-level restriction. That let ANY authenticated user set their
-- own `role` to 'admin' (and `tier` to a paid plan). Once self-promoted,
-- is_admin_or_support() returned true for them, so the same policy's second
-- branch let them rewrite every other profile (demoting the real admin) and
-- pass the admin checks guarding branding/storage (cdn/brand/*, system_settings)
-- — enabling the logo/image defacement.
--
-- RLS WITH CHECK cannot compare OLD vs NEW, so we enforce column immutability
-- with a BEFORE UPDATE trigger: non-admins can never change `role`/`tier`
-- (silently reverted), while admin/support can, and every privileged change is
-- recorded for traceability. The existing policy is left intact so users keep
-- editing their own non-privileged fields (name, avatar, bio, ocid, …).

-- -----------------------------------------------------------------------------
-- 1) Audit table (private schema; never exposed to anon/authenticated)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.profile_privilege_audit (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_id        uuid NOT NULL,
  actor_id         uuid,                 -- auth.uid() of caller; NULL for service-role/SQL-editor
  old_role         text,
  new_role         text,
  old_tier         text,
  new_tier         text,
  was_admin_caller boolean NOT NULL,     -- whether caller passed public.is_admin_or_support()
  blocked          boolean NOT NULL,     -- true => change was reverted (non-admin attempt)
  created_at       timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.profile_privilege_audit FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2) Guard trigger function
--    SECURITY DEFINER so the audit INSERT succeeds even for a non-admin caller
--    (who has no grant on the private table). auth.uid() / is_admin_or_support()
--    still resolve to the REAL caller because they read the request JWT claims,
--    not current_user.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin     boolean := public.is_admin_or_support();
  v_role_changed boolean := NEW.role IS DISTINCT FROM OLD.role;
  v_tier_changed boolean := NEW.tier IS DISTINCT FROM OLD.tier;
BEGIN
  IF v_role_changed OR v_tier_changed THEN
    INSERT INTO private.profile_privilege_audit
      (target_id, actor_id, old_role, new_role, old_tier, new_tier, was_admin_caller, blocked)
    VALUES
      (OLD.id, auth.uid(), OLD.role, NEW.role, OLD.tier, NEW.tier, v_is_admin, NOT v_is_admin);
  END IF;

  -- Non-admins may never change privileged columns: revert them silently.
  IF NOT v_is_admin THEN
    NEW.role := OLD.role;
    NEW.tier := OLD.tier;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_profile_privileged_columns() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3) Attach the trigger (BEFORE UPDATE, before the AFTER sync trigger fires)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_privileged_columns();
