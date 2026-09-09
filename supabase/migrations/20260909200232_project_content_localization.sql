-- Project text localization only; event content is managed through the admin UI.
CREATE OR REPLACE FUNCTION private.assert_project_content_editable(p_actor_id uuid, p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE; v_document jsonb; v_deadline timestamptz;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF p_actor_id IS NULL OR (v_project.owner_id <> p_actor_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role IN ('admin', 'support_staff')
  )) THEN RAISE EXCEPTION 'forbidden:project_update'; END IF;
  IF v_project.blocked THEN RAISE EXCEPTION 'forbidden:project_blocked'; END IF;
  IF v_project.source_type IN ('hackathon', 'contest') THEN
    SELECT document INTO v_document FROM public.hackathons WHERE id = v_project.source_id;
    IF v_document IS NULL THEN RAISE EXCEPTION 'not_found:hackathon'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hackathon_registrations WHERE hackathon_id = v_project.source_id
      AND user_id = v_project.owner_id AND document->>'status' IN ('registered', 'approved')) THEN
      RAISE EXCEPTION 'forbidden:registration_required';
    END IF;
    v_deadline := COALESCE(NULLIF(v_document->>'submission_deadline', '')::timestamptz, NULLIF(v_document->>'ends_at', '')::timestamptz);
    IF clock_timestamp() > v_deadline THEN RAISE EXCEPTION 'forbidden:submission_deadline_passed'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.assert_project_content_editable(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.assert_project_content_editable(uuid,uuid) TO service_role;

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
    IF v_project.source_type IN ('hackathon','contest') AND COALESCE(v_project.progress,'') !~ '[[:alnum:]]' THEN
      RAISE EXCEPTION 'required_content:progress';
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

-- Legacy config writes keep their interface and synchronize a changed primary language.
CREATE OR REPLACE FUNCTION private.update_ai_gated_project_i18n(p_actor_id uuid,p_project_id uuid,p_i18n jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_primary text; v_content jsonb; v_project public.projects%ROWTYPE;
BEGIN
  PERFORM private.assert_project_content_editable(p_actor_id,p_project_id);
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  v_primary := COALESCE(p_i18n->>'primary_content_locale',v_project.i18n->>'primary_content_locale','vi');
  IF v_primary NOT IN ('vi','en') THEN RAISE EXCEPTION 'invalid_input:project_locale'; END IF;
  SELECT data INTO v_content FROM public.project_locales WHERE project_id=p_project_id AND locale=v_primary;
  v_content := jsonb_build_object(
    'title',COALESCE(NULLIF(btrim(v_content->>'title'),''),v_project.title),
    'summary',COALESCE(NULLIF(btrim(v_content->>'summary'),''),v_project.summary),
    'description',COALESCE(NULLIF(btrim(v_content->>'description'),''),v_project.description),
    'progress',COALESCE(NULLIF(btrim(v_content->>'progress'),''),v_project.progress));
  UPDATE public.projects SET i18n=COALESCE(p_i18n,'{}'::jsonb) || jsonb_build_object('primary_content_locale',v_primary) WHERE id=p_project_id;
  PERFORM private.save_ai_gated_project_locale(p_actor_id,p_project_id,v_primary,v_content);
END;
$$;
REVOKE ALL ON FUNCTION private.update_ai_gated_project_i18n(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.update_ai_gated_project_i18n(uuid,uuid,jsonb) TO service_role;

DROP FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[], text, text, text);
CREATE FUNCTION public.save_ai_gated_project(
  p_actor_id uuid,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_logo_path text DEFAULT NULL,
  p_screenshot_paths text[] DEFAULT '{}'::text[],
  p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'standalone',
  p_source_id text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}'::text[],
  p_sector_ids text[] DEFAULT '{}'::text[],
  p_tech_stack_ids text[] DEFAULT '{}'::text[],
  p_description text DEFAULT NULL,
  p_progress text DEFAULT NULL,
  p_pitch_video_url text DEFAULT NULL,
  p_primary_content_locale text DEFAULT NULL,
  p_locales jsonb DEFAULT NULL
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_primary text; v_locale text; v_content jsonb;
BEGIN
  -- Two open Create forms must not race past the existing-submission check.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || COALESCE(p_source_id, p_project_id::text), 0));
  IF EXISTS (SELECT 1 FROM public.projects WHERE id=p_project_id) THEN
    PERFORM private.assert_project_content_editable(p_actor_id,p_project_id);
  END IF;
  IF p_locales IS NOT NULL AND (jsonb_typeof(p_locales) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_locales) k WHERE k NOT IN ('vi','en')
  )) THEN RAISE EXCEPTION 'invalid_input:project_locales'; END IF;
  IF p_primary_content_locale IS NOT NULL AND (p_primary_content_locale NOT IN ('vi','en') OR p_locales IS NULL) THEN
    RAISE EXCEPTION 'invalid_input:project_locales';
  END IF;
  RETURN QUERY SELECT * FROM private.save_ai_gated_project(
    p_actor_id, p_project_id, p_slug, p_title, p_summary, p_demo_url,
    p_repo_url, p_slide_url, p_video_url, p_logo_path, p_screenshot_paths,
    p_visibility, p_source_type, p_source_id, p_track_ids, p_sector_ids,
    p_tech_stack_ids
  );
  UPDATE public.projects p SET
    description = CASE WHEN p_description IS NULL THEN p.description ELSE NULLIF(btrim(p_description), '') END,
    progress = CASE WHEN p_progress IS NULL THEN p.progress ELSE NULLIF(btrim(p_progress), '') END,
    pitch_video_url = CASE WHEN p_pitch_video_url IS NULL THEN p.pitch_video_url ELSE NULLIF(btrim(p_pitch_video_url), '') END
  WHERE p.id = p_project_id;
  SELECT COALESCE(p_primary_content_locale,i18n->>'primary_content_locale','vi') INTO v_primary FROM public.projects WHERE id=p_project_id;
  IF p_primary_content_locale IS NOT NULL THEN
    UPDATE public.projects SET i18n = COALESCE(i18n,'{}'::jsonb) || jsonb_build_object(
      'primary_content_locale',v_primary,'supported_locales',jsonb_build_array('vi','en')) WHERE id=p_project_id;
  END IF;
  FOR v_locale,v_content IN SELECT key,value FROM jsonb_each(COALESCE(p_locales,'{}'::jsonb)) LOOP
    IF v_locale <> v_primary THEN
      PERFORM private.save_ai_gated_project_locale(p_actor_id,p_project_id,v_locale,v_content);
    END IF;
  END LOOP;
  -- Canonical columns always hold the primary content, including old-client saves.
  INSERT INTO public.project_locales(project_id,locale,data)
    SELECT id,v_primary,jsonb_strip_nulls(jsonb_build_object('title',title,'summary',summary,
      'description',description,'progress',progress,'updated_at',clock_timestamp())) FROM public.projects WHERE id=p_project_id
  ON CONFLICT ON CONSTRAINT project_locales_pkey DO UPDATE SET data=EXCLUDED.data;
END;
$$;
REVOKE ALL ON FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[], text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[], text, text, text, text, jsonb) TO service_role;

-- A rolling-hour quota shared by every Edge instance; no content is stored here.
CREATE TABLE private.project_translation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX project_translation_requests_actor_time ON private.project_translation_requests(actor_id,created_at);
ALTER TABLE private.project_translation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_translation_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON private.project_translation_requests TO service_role;
CREATE FUNCTION public.reserve_project_translation(p_actor_id uuid,p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL THEN RAISE EXCEPTION 'invalid_input:project_identity'; END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id=p_project_id) THEN
    PERFORM private.assert_project_content_editable(p_actor_id,p_project_id);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-translate:' || p_actor_id::text,0));
  DELETE FROM private.project_translation_requests WHERE actor_id=p_actor_id AND created_at <= clock_timestamp()-interval '1 hour';
  IF (SELECT count(*) FROM private.project_translation_requests WHERE actor_id=p_actor_id) >= 10 THEN
    RAISE EXCEPTION 'rate_limited:project_translation';
  END IF;
  INSERT INTO private.project_translation_requests(actor_id) VALUES(p_actor_id) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_project_translation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_project_translation(uuid,uuid) TO service_role;
