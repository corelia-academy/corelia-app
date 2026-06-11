-- Fix an over-restriction in the privilege-escalation guard
-- (private.guard_profile_privileged_columns, added in 20260709000000).
--
-- The original guard allowed role/tier changes only when public.is_admin_or_support()
-- returned true. That check is keyed on auth.uid() (the request JWT), which is NULL
-- for trusted backend contexts (service_role, the Supabase dashboard SQL/Table editor,
-- and migrations). As a result, an admin editing a user's role directly in the
-- dashboard was silently reverted.
--
-- Treat a NULL auth.uid() as a trusted backend caller. This is safe: the
-- profiles RLS policy (id = auth.uid() OR is_admin_or_support()) already blocks
-- anon/non-admin authenticated UPDATEs before the trigger fires, so the only way
-- to reach this trigger with a NULL uid is via an RLS-exempt backend role.

CREATE OR REPLACE FUNCTION private.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid    := auth.uid();
  v_is_privileged boolean := (v_uid IS NULL) OR public.is_admin_or_support();
  v_role_changed  boolean := NEW.role IS DISTINCT FROM OLD.role;
  v_tier_changed  boolean := NEW.tier IS DISTINCT FROM OLD.tier;
BEGIN
  IF v_role_changed OR v_tier_changed THEN
    INSERT INTO private.profile_privilege_audit
      (target_id, actor_id, old_role, new_role, old_tier, new_tier, was_admin_caller, blocked)
    VALUES
      (OLD.id, v_uid, OLD.role, NEW.role, OLD.tier, NEW.tier, v_is_privileged, NOT v_is_privileged);
  END IF;

  IF NOT v_is_privileged THEN
    NEW.role := OLD.role;
    NEW.tier := OLD.tier;
  END IF;

  RETURN NEW;
END;
$$;
