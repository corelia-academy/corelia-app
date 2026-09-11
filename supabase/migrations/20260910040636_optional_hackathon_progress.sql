-- Progress is optional for hackathon projects, including primary-locale edits.
CREATE OR REPLACE FUNCTION private.save_ai_gated_project_locale(p_actor_id uuid, p_project_id uuid, p_locale text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_data jsonb; v_primary text; v_project public.projects%ROWTYPE;
BEGIN
  PERFORM private.assert_project_content_editable(p_actor_id, p_project_id);
  IF p_locale IS NULL OR p_locale NOT IN ('vi','en') OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_input:project_locales';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_data) WHERE key NOT IN ('title','summary','description','progress','updated_at')
    OR (key <> 'updated_at' AND jsonb_typeof(value) NOT IN ('string','null'))) THEN
    RAISE EXCEPTION 'invalid_input:project_locales';
  END IF;
  IF char_length(p_data->>'title') > 160 OR char_length(p_data->>'summary') > 1000
    OR char_length(p_data->>'description') > 20000 OR char_length(p_data->>'progress') > 10000 THEN
    RAISE EXCEPTION 'invalid_input:project_content';
  END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  v_primary := COALESCE(v_project.i18n->>'primary_content_locale','vi');
  -- Partial legacy locale writes preserve omitted fields; explicit blanks clear translations.
  SELECT COALESCE(data,'{}'::jsonb) INTO v_data FROM public.project_locales WHERE project_id = p_project_id AND locale = p_locale;
  v_data := COALESCE(v_data,'{}'::jsonb) || (p_data - 'updated_at');
  IF p_locale = v_primary THEN
    UPDATE public.projects SET
      title = CASE WHEN p_data ? 'title' THEN COALESCE(NULLIF(btrim(p_data->>'title'),''),title) ELSE title END,
      summary = CASE WHEN p_data ? 'summary' THEN NULLIF(btrim(p_data->>'summary'),'') ELSE summary END,
      description = CASE WHEN p_data ? 'description' THEN NULLIF(btrim(p_data->>'description'),'') ELSE description END,
      progress = CASE WHEN p_data ? 'progress' THEN NULLIF(btrim(p_data->>'progress'),'') ELSE progress END
    WHERE id = p_project_id RETURNING * INTO v_project;
    IF (v_project.visibility <> 'private' OR v_project.source_type IN ('hackathon','contest')) AND
      (COALESCE(v_project.summary,'') !~ '[[:alnum:]]' OR COALESCE(v_project.description,'') !~ '[[:alnum:]]') THEN
      RAISE EXCEPTION 'required_content:description';
    END IF;
    v_data := jsonb_build_object('title',v_project.title,'summary',v_project.summary,'description',v_project.description,'progress',v_project.progress);
  END IF;
  INSERT INTO public.project_locales(project_id,locale,data)
  VALUES (p_project_id,p_locale,jsonb_strip_nulls(v_data || jsonb_build_object('updated_at',clock_timestamp())))
  ON CONFLICT ON CONSTRAINT project_locales_pkey DO UPDATE SET data = EXCLUDED.data;
END;
$$;
REVOKE ALL ON FUNCTION private.save_ai_gated_project_locale(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.save_ai_gated_project_locale(uuid,uuid,text,jsonb) TO service_role;

-- Publication follows the editor: progress and resource links are optional.
CREATE OR REPLACE FUNCTION public.manage_project(p_actor_id uuid, p_project_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_admin boolean;
  v_reason text := nullif(btrim(p_reason), '');
BEGIN
  SELECT COALESCE(pr.role='admin',false) INTO v_admin FROM public.profiles pr WHERE pr.id=p_actor_id;
  SELECT * INTO v_project FROM public.projects p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF p_actor_id IS NULL OR NOT COALESCE(v_admin,false) AND NOT (p_action='delete' AND v_project.owner_id=p_actor_id) THEN
    RAISE EXCEPTION 'forbidden:project_manage';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('delete','block','unblock','public','unlisted','private') THEN
    RAISE EXCEPTION 'invalid_input:project_action';
  END IF;
  IF char_length(v_reason)>1000 OR (COALESCE(v_admin,false) AND (v_reason IS NULL OR v_reason !~ '[[:alnum:]]')) THEN
    RAISE EXCEPTION 'invalid_input:moderation_reason';
  END IF;
  IF v_project.blocked AND p_action IN ('public','unlisted') THEN
    RAISE EXCEPTION 'forbidden:project_blocked';
  END IF;
  IF p_action IN ('public','unlisted') AND (
    COALESCE(v_project.summary,'') !~ '[[:alnum:]]' OR COALESCE(v_project.description,'') !~ '[[:alnum:]]'
  ) THEN RAISE EXCEPTION 'required_content:description'; END IF;
  INSERT INTO private.project_moderation_audit(project_id,actor_id,action,reason,snapshot)
  VALUES(p_project_id,p_actor_id,p_action,v_reason,jsonb_build_object('project',to_jsonb(v_project),'submissions',
    (SELECT jsonb_agg(to_jsonb(s)) FROM public.hackathon_submissions s WHERE s.project_id=p_project_id)));

  IF p_action='delete' THEN
    -- Queue files for the existing expiry cleanup; the transaction first removes
    -- all project references, so retries cannot delete another project's media.
    INSERT INTO public.project_media_uploads(path,owner_id,project_id,expires_at)
    SELECT path,v_project.owner_id,p_project_id,now()
    FROM unnest(array_prepend(v_project.logo_path,v_project.screenshot_paths)) path
    WHERE path IS NOT NULL
    ON CONFLICT(path) DO UPDATE SET expires_at=now();
    DELETE FROM public.hackathon_submissions WHERE project_id=p_project_id;
    DELETE FROM public.projects WHERE id=p_project_id;
  ELSIF p_action='block' THEN
    UPDATE public.projects SET blocked=true,visibility='private' WHERE id=p_project_id;
  ELSIF p_action='unblock' THEN
    UPDATE public.projects SET blocked=false WHERE id=p_project_id;
  ELSE
    UPDATE public.projects SET visibility=p_action WHERE id=p_project_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_project(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_project(uuid,uuid,text,text) TO service_role;
