-- Keep historical sources editable while requiring every newly created project
-- to come through the hackathon submission boundary. This function predates
-- several wrappers; change its body in place so its signature and grants stay put.
DO $migration$
DECLARE v_sql text; v_old text; v_new text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.save_ai_gated_project(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[])'::regprocedure
  ) INTO v_sql;
  v_old := 'IF v_source_type NOT IN (''standalone'', ''hackathon'') THEN';
  v_new := 'IF v_source_type <> ''hackathon'' THEN';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project source gate changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,v_new);
  v_old := E'IF NOT EXISTS (\n      SELECT 1\n      FROM public.hackathon_registrations r';
  v_new := E'IF NOT COALESCE(v_is_staff,false) AND NOT EXISTS (\n      SELECT 1\n      FROM public.hackathon_registrations r';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project registration gate changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,v_new);
  v_old := 'IF v_deadline IS NOT NULL AND v_now > v_deadline THEN';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project deadline gate changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,'IF NOT COALESCE(v_is_staff,false) AND v_deadline IS NOT NULL AND v_now > v_deadline THEN');
  v_old := 'AND h.status IN (''published'', ''running'', ''ended'');';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project hackathon state gate changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,'AND (v_is_staff OR h.status IN (''published'', ''running'', ''ended''));');
  v_old := E'INTO v_is_staff\n  FROM public.profiles pr\n  WHERE pr.id = p_actor_id;';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project staff lookup changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,v_old || E'\n  IF v_is_staff THEN PERFORM pg_catalog.set_config(''corelia.project_staff_edit'',''on'',true); END IF;');
  v_old := 'v_project.owner_id <> p_actor_id AND NOT v_is_staff';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project ownership check changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,'v_project.owner_id <> p_actor_id AND NOT COALESCE(v_is_staff,false)');
  v_old := 'visibility = CASE WHEN v_source_type IN (''contest'', ''hackathon'') THEN ''public'' ELSE p_visibility END,';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project visibility update changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,
    'visibility = CASE WHEN v_project.blocked THEN ''private'' WHEN v_is_staff THEN p_visibility WHEN v_source_type IN (''contest'', ''hackathon'') THEN ''public'' ELSE p_visibility END,');
  v_old := 'p_logo_path = v_project.logo_path';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project media ownership check changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,'p_logo_path IS NOT DISTINCT FROM v_project.logo_path');
  EXECUTE v_sql;
END;
$migration$;

ALTER TABLE private.project_moderation_audit DROP CONSTRAINT project_moderation_audit_action_check;
ALTER TABLE private.project_moderation_audit ADD CONSTRAINT project_moderation_audit_action_check
  CHECK (action IN ('delete','block','unblock','public','unlisted','private','transfer_hackathon'));
GRANT UPDATE(snapshot) ON private.project_moderation_audit TO service_role;

CREATE FUNCTION public.transfer_project_hackathon(
  p_actor_id uuid, p_project_id uuid, p_target_hackathon_id text,
  p_track_ids text[], p_reason text
) RETURNS TABLE(project_id uuid, hackathon_id text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_target public.hackathons%ROWTYPE;
  v_source_submission public.hackathon_submissions%ROWTYPE;
  v_id text;
  v_reason text := nullif(btrim(p_reason),'');
  v_tracks text[];
  v_sectors text[];
  v_tech text[];
  v_document jsonb;
  v_audit_id bigint;
BEGIN
  IF p_actor_id IS NULL OR p_project_id IS NULL OR nullif(btrim(p_target_hackathon_id),'') IS NULL
    OR v_reason IS NULL OR length(v_reason)>1000 OR v_reason !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION 'invalid_input:project_transfer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor_id AND role IN ('admin','support_staff')) THEN
    RAISE EXCEPTION 'forbidden:project_transfer';
  END IF;
  PERFORM pg_catalog.set_config('corelia.project_staff_edit','on',true);
  -- Serialize competing transfers and saves for the same owner and destination.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id::text,0));
  SELECT * INTO v_project FROM public.projects p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF v_project.source_type IN ('contest','hackathon') AND v_project.source_id=p_target_hackathon_id THEN
    RETURN QUERY SELECT p_project_id,p_target_hackathon_id;
    RETURN;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_project.owner_id::text||':'||p_target_hackathon_id,0));
  SELECT * INTO v_target FROM public.hackathons h WHERE h.id=p_target_hackathon_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:hackathon'; END IF;
  v_id := p_target_hackathon_id||'_'||v_project.owner_id::text;
  IF EXISTS (SELECT 1 FROM public.hackathon_submissions hs WHERE hs.id=v_id)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.owner_id=v_project.owner_id
      AND p.source_type IN ('contest','hackathon') AND p.source_id=p_target_hackathon_id AND p.id<>p_project_id) THEN
    RAISE EXCEPTION 'conflict:hackathon_project_exists';
  END IF;
  SELECT COALESCE(array_agg(item->>'id'),'{}') INTO v_tracks
  FROM jsonb_array_elements(COALESCE(v_target.document->'tracks','[]'::jsonb)) item
  WHERE COALESCE(item->>'active','true')<>'false';
  IF cardinality(COALESCE(p_track_ids,'{}'))=0 OR NOT p_track_ids <@ v_tracks THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy';
  END IF;
  SELECT COALESCE(array_agg(item->>'id'),'{}') INTO v_sectors
  FROM jsonb_array_elements(COALESCE(v_target.document->'sectors','[]'::jsonb)) item
  WHERE COALESCE(item->>'active','true')<>'false';
  SELECT COALESCE(array_agg(item->>'id'),'{}') INTO v_tech
  FROM jsonb_array_elements(COALESCE(v_target.document->'tech_stacks','[]'::jsonb)) item
  WHERE COALESCE(item->>'active','true')<>'false';
  IF cardinality(v_sectors)=0 OR cardinality(v_tech)=0 THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy_required';
  END IF;
  SELECT * INTO v_source_submission FROM public.hackathon_submissions hs WHERE hs.project_id=p_project_id FOR UPDATE;
  INSERT INTO private.project_moderation_audit(project_id,actor_id,action,reason,snapshot)
  VALUES (p_project_id,p_actor_id,'transfer_hackathon',v_reason,
    jsonb_build_object('project_before',to_jsonb(v_project),'submission_before',to_jsonb(v_source_submission),
      'target_hackathon_id',p_target_hackathon_id,'target_track_ids',p_track_ids)) RETURNING id INTO v_audit_id;
  INSERT INTO public.hackathon_registrations(id,hackathon_id,user_id,document)
  VALUES(v_id,p_target_hackathon_id,v_project.owner_id,
    jsonb_build_object('status','approved','applied_at',clock_timestamp(),'updated_at',clock_timestamp(),
      'approved_by',p_actor_id,'source','project_transfer'))
  ON CONFLICT (id) DO UPDATE SET document=public.hackathon_registrations.document ||
    jsonb_build_object('status','approved','updated_at',clock_timestamp(),
      'approved_by',p_actor_id,'source','project_transfer');
  -- The historical award stays on the source hackathon document, independent
  -- of the live submission. Only the live submission follows the project.
  IF v_source_submission.id IS NOT NULL THEN
    DELETE FROM public.hackathon_submissions WHERE id=v_source_submission.id;
  END IF;
  UPDATE public.projects SET source_type='hackathon',source_id=p_target_hackathon_id,
    source_submission_id=v_id,hackathon_track_ids=p_track_ids,
    hackathon_sector_ids=ARRAY[COALESCE((SELECT x FROM unnest(v_project.hackathon_sector_ids) x WHERE x=ANY(v_sectors) LIMIT 1),v_sectors[1])],
    hackathon_tech_stack_ids=ARRAY[COALESCE((SELECT x FROM unnest(v_project.hackathon_tech_stack_ids) x WHERE x=ANY(v_tech) LIMIT 1),v_tech[1])],
    updated_at=clock_timestamp() WHERE id=p_project_id;
  v_document := jsonb_build_object(
    'registration_id',v_id,'project_id',p_project_id,'title',v_project.title,'summary',v_project.summary,
    'description',v_project.description,'progress',v_project.progress,
    'demo_url',v_project.demo_url,'repo_url',v_project.repo_url,'slide_url',v_project.slide_url,
    'video_url',v_project.video_url,'pitch_video_url',v_project.pitch_video_url,
    'logo_path',v_project.logo_path,'screenshot_paths',to_jsonb(v_project.screenshot_paths),
    'track_ids',p_track_ids,'sector_ids',(SELECT p.hackathon_sector_ids FROM public.projects p WHERE p.id=p_project_id),
    'tech_stack_ids',(SELECT p.hackathon_tech_stack_ids FROM public.projects p WHERE p.id=p_project_id),
    'custom_sector_names',v_project.custom_sector_names,'custom_tech_stack_names',v_project.custom_tech_stack_names,
    'updated_at',clock_timestamp(),'submitted_at',clock_timestamp());
  INSERT INTO public.hackathon_submissions(id,hackathon_id,user_id,project_id,document)
  VALUES(v_id,p_target_hackathon_id,v_project.owner_id,p_project_id,v_document);
  UPDATE private.project_moderation_audit a SET snapshot=a.snapshot || jsonb_build_object(
    'project_after',(SELECT to_jsonb(p) FROM public.projects p WHERE p.id=p_project_id),
    'submission_after',(SELECT to_jsonb(s) FROM public.hackathon_submissions s WHERE s.id=v_id))
  WHERE a.id=v_audit_id;
  RETURN QUERY SELECT p_project_id,p_target_hackathon_id;
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_project_hackathon(uuid,uuid,text,text[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_project_hackathon(uuid,uuid,text,text[],text) TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_instant_hackathon_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_document jsonb; v_deadline timestamptz;
BEGIN
  -- Only the authenticated staff transfer RPC sets this flag. Browser roles do
  -- not have INSERT/UPDATE rights on the protected project write path.
  IF pg_catalog.current_setting('role',true)='service_role'
    AND pg_catalog.current_setting('corelia.project_staff_edit',true)='on'
    AND NEW.document->>'source'='project_transfer' THEN RETURN NEW; END IF;
  SELECT h.status,h.document INTO v_status,v_document FROM public.hackathons h WHERE h.id=NEW.hackathon_id;
  IF v_status NOT IN ('published','running') THEN RAISE EXCEPTION 'forbidden:registration_closed'; END IF;
  v_deadline := NULLIF(v_document->>'registration_deadline','')::timestamptz;
  IF v_deadline IS NOT NULL AND clock_timestamp()>v_deadline THEN
    RAISE EXCEPTION 'forbidden:registration_deadline_passed';
  END IF;
  NEW.document := (NEW.document-'reviewed_at'-'reviewed_by'-'review_note') ||
    jsonb_build_object('status','registered','updated_at',clock_timestamp());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.email_on_hackathon_registration_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_title text;
BEGIN
  IF pg_catalog.current_setting('role',true)='service_role'
    AND pg_catalog.current_setting('corelia.project_staff_edit',true)='on'
    AND NEW.document->>'source'='project_transfer' THEN RETURN NEW; END IF;
  IF NEW.document->>'status'='approved' AND
    (TG_OP='INSERT' OR COALESCE(OLD.document->>'status','')<>'approved') THEN
    SELECT COALESCE(h.document->>'title','') INTO v_title FROM public.hackathons h WHERE h.id=NEW.hackathon_id;
    PERFORM private.enqueue_email_automations(NEW.user_id,'object_registration_approved',
      'hackathon_registration_approved:'||NEW.id,'hackathon',NEW.hackathon_id,
      jsonb_build_object('hackathon_id',NEW.hackathon_id,'event_name',COALESCE(v_title,'')));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.auto_follow_on_hackathon_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF pg_catalog.current_setting('role',true)='service_role'
    AND pg_catalog.current_setting('corelia.project_staff_edit',true)='on'
    AND NEW.document->>'source'='project_transfer' THEN RETURN NEW; END IF;
  INSERT INTO public.follows(follower_id,subject_type,subject_id)
  VALUES(NEW.user_id,'hackathon',NEW.hackathon_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_project_content_editable(p_actor_id uuid, p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE; v_document jsonb; v_deadline timestamptz; v_staff boolean;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  SELECT role IN ('admin','support_staff') INTO v_staff FROM public.profiles WHERE id=p_actor_id;
  IF p_actor_id IS NULL OR (v_project.owner_id <> p_actor_id AND NOT COALESCE(v_staff,false)) THEN
    RAISE EXCEPTION 'forbidden:project_update';
  END IF;
  IF v_staff THEN RETURN; END IF;
  IF v_project.blocked THEN RAISE EXCEPTION 'forbidden:project_blocked'; END IF;
  IF v_project.source_type IN ('hackathon','contest') THEN
    SELECT document INTO v_document FROM public.hackathons WHERE id=v_project.source_id;
    IF v_document IS NULL THEN RAISE EXCEPTION 'not_found:hackathon'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hackathon_registrations WHERE hackathon_id=v_project.source_id
      AND user_id=v_project.owner_id AND document->>'status' IN ('registered','approved')) THEN
      RAISE EXCEPTION 'forbidden:registration_required';
    END IF;
    v_deadline := COALESCE(NULLIF(v_document->>'submission_deadline','')::timestamptz,
                           NULLIF(v_document->>'ends_at','')::timestamptz);
    IF v_deadline IS NOT NULL AND clock_timestamp()>v_deadline THEN
      RAISE EXCEPTION 'forbidden:submission_deadline_passed';
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.assert_project_content_editable(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.assert_project_content_editable(uuid,uuid) TO service_role;

-- The old deadline trigger runs under the service role, where auth.uid() is
-- empty. Only the staff-verified save RPC sets this transaction-local flag.
CREATE OR REPLACE FUNCTION private.enforce_contest_project_submission_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_document jsonb; v_deadline timestamptz;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.source_type NOT IN ('contest','hackathon') OR NEW.source_id IS NULL
     OR public.is_admin_or_support() OR pg_catalog.current_setting('corelia.project_staff_edit',true)='on' THEN
    RETURN NEW;
  END IF;
  SELECT document INTO v_document FROM public.hackathons WHERE id=NEW.source_id;
  v_deadline := COALESCE(NULLIF(v_document->>'submission_deadline','')::timestamptz,
                         NULLIF(v_document->>'ends_at','')::timestamptz);
  IF v_deadline IS NOT NULL AND clock_timestamp()>v_deadline AND (
    NEW.slug IS DISTINCT FROM OLD.slug OR NEW.title IS DISTINCT FROM OLD.title OR
    NEW.summary IS DISTINCT FROM OLD.summary OR NEW.demo_url IS DISTINCT FROM OLD.demo_url OR
    NEW.repo_url IS DISTINCT FROM OLD.repo_url OR NEW.slide_url IS DISTINCT FROM OLD.slide_url OR
    NEW.hackathon_track_ids IS DISTINCT FROM OLD.hackathon_track_ids OR
    NEW.hackathon_sector_ids IS DISTINCT FROM OLD.hackathon_sector_ids OR
    NEW.hackathon_tech_stack_ids IS DISTINCT FROM OLD.hackathon_tech_stack_ids
  ) THEN RAISE EXCEPTION 'forbidden:submission_deadline_passed'; END IF;
  RETURN NEW;
END;
$$;

-- Extend the existing audited moderation operation to support both staff roles.
DO $migration$
DECLARE v_sql text; v_old text := 'pr.role=''admin''';
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.manage_project(uuid,uuid,text,text)'::regprocedure) INTO v_sql;
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project moderation role gate changed upstream'; END IF;
  EXECUTE replace(v_sql,v_old,'pr.role IN (''admin'',''support_staff'')');
END;
$migration$;
