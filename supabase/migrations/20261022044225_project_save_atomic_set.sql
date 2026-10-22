CREATE FUNCTION public.set_project_saved(
  p_project_id uuid,
  p_saved boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  u uuid := auth.uid();
  affected bigint;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'project_save_requires_authentication'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'project_save:' || u::text || ':' || p_project_id::text,
      0
    )
  );

  IF p_saved THEN
    INSERT INTO public.project_saves (project_id, user_id)
    VALUES (p_project_id, u)
    ON CONFLICT (user_id, project_id) DO NOTHING;
  ELSE
    DELETE FROM public.project_saves
    WHERE project_id = p_project_id
      AND user_id = u;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN jsonb_build_object(
    'saved', p_saved,
    'changed', affected > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_saved(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_project_saved(uuid, boolean)
  TO authenticated;
