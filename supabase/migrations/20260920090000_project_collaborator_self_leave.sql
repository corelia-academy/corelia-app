-- #499: let a direct collaborator remove only their own Corelia membership.
-- The existing manager RPC remains responsible for removing another member.

CREATE OR REPLACE FUNCTION private.leave_project(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input:project_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = p_project_id
      AND owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden:project_owner';
  END IF;

  DELETE FROM public.project_collaborators
  WHERE project_id = p_project_id
    AND user_id = v_uid
  RETURNING project_id INTO v_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'collaborator_not_found';
  END IF;

  RETURN json_build_object('ok', true, 'project_id', v_project_id);
END;
$$;

REVOKE ALL ON FUNCTION private.leave_project(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.leave_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_project(p_project_id uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.leave_project(p_project_id);
$$;

REVOKE ALL ON FUNCTION public.leave_project(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_project(uuid) TO authenticated;
