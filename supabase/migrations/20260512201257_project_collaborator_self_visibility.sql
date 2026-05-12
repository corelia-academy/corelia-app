CREATE OR REPLACE FUNCTION public.set_my_project_collaboration_visibility(
  p_project_id uuid,
  p_show_in_portfolio boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_collaborators pc
    WHERE pc.project_id = p_project_id
      AND pc.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'collaborator_not_found';
  END IF;

  UPDATE public.project_collaborators
  SET show_in_portfolio = COALESCE(p_show_in_portfolio, true)
  WHERE project_id = p_project_id
    AND user_id = v_uid;

  RETURN json_build_object(
    'ok', true,
    'project_id', p_project_id,
    'show_in_portfolio', COALESCE(p_show_in_portfolio, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean) TO authenticated;
