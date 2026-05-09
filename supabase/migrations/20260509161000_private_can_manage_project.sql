-- SECURITY DEFINER helper used by project_locale RLS in entity_locales.
-- Also recreated by 20260608190000_fix_projects_rls_recursion.sql (CREATE OR REPLACE).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.can_manage_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_owner uuid;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT owner_id
  INTO v_owner
  FROM public.projects
  WHERE id = p_project_id;

  RETURN (v_owner = p_user_id) OR public.is_admin_or_support();
END;
$$;

GRANT EXECUTE ON FUNCTION private.can_manage_project(uuid, uuid) TO anon, authenticated;
