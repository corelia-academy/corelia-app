-- Fix infinite recursion in RLS policies between `projects` and `project_collaborators`.
-- Root cause: policies referenced each other via EXISTS subqueries, causing recursive RLS evaluation.

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, row_security off)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_project_collaborator(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.project_collaborators pc
    WHERE pc.project_id = p_project_id
      AND pc.user_id = p_user_id
      AND pc.show_in_portfolio = true
  );
END;
$$;

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

GRANT EXECUTE ON FUNCTION private.is_project_collaborator(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_project(uuid, uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Rewrite policies to remove recursive EXISTS chains
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS projects_select_policy ON public.projects;
CREATE POLICY projects_select_policy
  ON public.projects FOR SELECT
  TO authenticated, anon
  USING (
    visibility IN ('public', 'unlisted')
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
    OR private.is_project_collaborator(projects.id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_collaborators_select ON public.project_collaborators;
CREATE POLICY project_collaborators_select
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_project(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_collaborators_manage_owner ON public.project_collaborators;
CREATE POLICY project_collaborators_manage_owner
  ON public.project_collaborators FOR ALL
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

