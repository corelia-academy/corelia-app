-- Tell the owner when background moderation hides their project. The notice is
-- transactional (not covered by social notification preferences) and names
-- only the flagged fields, never the provider categories.
CREATE OR REPLACE FUNCTION public.finish_project_moderation(p_project_id uuid, p_flagged_fields text[])
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE;
BEGIN
  DELETE FROM private.project_moderation_queue WHERE project_id = p_project_id;
  IF COALESCE(cardinality(p_flagged_fields),0) = 0 THEN RETURN false; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.blocked OR v_project.visibility = 'private' THEN RETURN false; END IF;
  INSERT INTO private.project_moderation_audit(project_id,actor_id,action,reason,snapshot)
  VALUES (p_project_id, NULL, 'block',
    'automatic: flagged ' || array_to_string(p_flagged_fields, ', '),
    jsonb_build_object('project', to_jsonb(v_project)));
  UPDATE public.projects SET blocked = true, visibility = 'private' WHERE id = p_project_id;
  UPDATE public.project_reports SET status = 'actioned', resolved_at = clock_timestamp()
  WHERE project_id = p_project_id AND status = 'open';
  INSERT INTO public.user_notifications(user_id,type,payload)
  VALUES (v_project.owner_id, 'project_auto_hidden', jsonb_build_object(
    'project_id', v_project.id,
    'project_title', v_project.title,
    'project_slug', v_project.slug,
    'fields', to_jsonb(p_flagged_fields),
    'target_path', '/projects/' || v_project.slug
  ));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_project_moderation(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_project_moderation(uuid,text[]) TO service_role;
