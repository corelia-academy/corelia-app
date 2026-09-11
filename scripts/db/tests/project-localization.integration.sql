DO $test$
DECLARE
  actor uuid := gen_random_uuid(); other_actor uuid := gen_random_uuid(); project uuid := gen_random_uuid();
  hackathon text := gen_random_uuid()::text; event_project uuid := gen_random_uuid(); i integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(actor),(other_actor);
  PERFORM set_config('role','service_role',true);
  PERFORM * FROM public.save_ai_gated_project(p_actor_id=>actor,p_project_id=>project,p_slug=>'localized-test',
    p_title=>'English title',p_summary=>'English summary',p_description=>'English story',p_progress=>'English progress',
    p_primary_content_locale=>'en',p_locales=>'{"en":{"title":"English title"},"vi":{"title":"Tên dự án","description":"Mô tả","progress":"Tiến độ"}}');
  PERFORM set_config('role','none',true);
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=project AND title='English title' AND i18n->>'primary_content_locale'='en')
    OR NOT EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=project AND locale='vi' AND data->>'description'='Mô tả' AND data->>'progress'='Tiến độ') THEN
    RAISE EXCEPTION 'Bilingual content not saved';
  END IF;
  -- Old clients preserve translations and update primary projection.
  PERFORM * FROM public.save_ai_gated_project(p_actor_id=>actor,p_project_id=>project,p_slug=>'localized-test',p_title=>'Legacy title');
  IF NOT EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=project AND locale='en' AND data->>'title'='Legacy title')
    OR NOT EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=project AND locale='vi' AND data->>'description'='Mô tả') THEN
    RAISE EXCEPTION 'Legacy save corrupted locales';
  END IF;
  BEGIN
    PERFORM * FROM public.save_ai_gated_project(p_actor_id=>actor,p_project_id=>project,p_slug=>'localized-test',p_title=>'Should rollback',
      p_primary_content_locale=>'en',p_locales=>jsonb_build_object('vi',jsonb_build_object('progress',repeat('x',10001))));
    RAISE EXCEPTION 'Invalid translation accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invalid_input:project_content%' THEN RAISE; END IF; END;
  IF (SELECT title FROM public.projects WHERE id=project) <> 'Legacy title' THEN RAISE EXCEPTION 'Save not atomic'; END IF;
  PERFORM public.save_ai_gated_project_locale(actor,project,'vi','{"summary":"Tóm tắt"}');
  IF NOT EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=project AND locale='vi' AND data->>'description'='Mô tả') THEN
    RAISE EXCEPTION 'Partial locale update erased story';
  END IF;
  PERFORM public.update_ai_gated_project_i18n(actor,project,'{"primary_content_locale":"vi","supported_locales":["vi","en"]}');
  IF (SELECT title FROM public.projects WHERE id=project) <> 'Tên dự án' THEN RAISE EXCEPTION 'Primary switch did not synchronize source'; END IF;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(other_actor,project,'en','{"title":"Forbidden"}');
    RAISE EXCEPTION 'Non-owner edited locale';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:project_update%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.reserve_project_translation(other_actor,project);
    RAISE EXCEPTION 'Non-owner translated private editor content';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:project_update%' THEN RAISE; END IF; END;
  FOR i IN 1..10 LOOP PERFORM public.reserve_project_translation(actor,project); END LOOP;
  BEGIN
    PERFORM public.reserve_project_translation(actor,project);
    RAISE EXCEPTION 'Eleventh translation allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%rate_limited:project_translation%' THEN RAISE; END IF; END;
  UPDATE private.project_translation_requests SET created_at=clock_timestamp()-interval '2 hours' WHERE actor_id=actor;
  PERFORM public.reserve_project_translation(actor,project);
  UPDATE public.projects SET blocked=true,visibility='private' WHERE id=project;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(actor,project,'en','{"title":"Blocked"}');
    RAISE EXCEPTION 'Blocked locale edit allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:project_blocked%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.update_ai_gated_project_i18n(actor,project,'{}');
    RAISE EXCEPTION 'Blocked config edit allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:project_blocked%' THEN RAISE; END IF; END;
  INSERT INTO public.hackathons(id,status,document) VALUES(hackathon,'published',jsonb_build_object('slug','locale-deadline-test','status','published','submission_deadline',clock_timestamp()+interval '1 day','tracks','[{"id":"track"}]'::jsonb,'sectors','[{"id":"sector"}]'::jsonb,'tech_stacks','[{"id":"tech"}]'::jsonb));
  INSERT INTO public.hackathon_registrations(id,hackathon_id,user_id,document) VALUES(hackathon||'_'||actor::text,hackathon,actor,'{"status":"registered"}');
  INSERT INTO public.projects(id,owner_id,slug,title,source_type,source_id,hackathon_track_ids,hackathon_sector_ids,hackathon_tech_stack_ids) VALUES(event_project,actor,'locale-deadline-project','Deadline','hackathon',hackathon,ARRAY['track'],ARRAY['sector'],ARRAY['tech']);
  -- Hackathon progress can be omitted, entered, and explicitly cleared in the primary locale.
  SET LOCAL ROLE service_role;
  PERFORM public.save_ai_gated_project_locale(actor,event_project,'vi','{"summary":"Idea summary","description":"Idea description"}');
  PERFORM public.save_ai_gated_project_locale(actor,event_project,'vi','{"progress":"Initial research"}');
  PERFORM public.save_ai_gated_project_locale(actor,event_project,'vi','{"progress":""}');
  IF EXISTS(SELECT 1 FROM public.projects WHERE id=event_project AND progress IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=event_project AND locale='vi' AND data->>'progress' IS NOT NULL) THEN
    RAISE EXCEPTION 'Optional hackathon progress was not cleared';
  END IF;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(actor,event_project,'vi',jsonb_build_object('progress',repeat('x',10001)));
    RAISE EXCEPTION 'Oversized optional progress accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invalid_input:project_content%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(actor,event_project,'vi','{"description":""}');
    RAISE EXCEPTION 'Required hackathon description cleared';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%required_content:description%' THEN RAISE; END IF; END;
  RESET ROLE;
  UPDATE public.profiles SET role='admin' WHERE id=other_actor;
  SET LOCAL ROLE service_role;
  PERFORM public.manage_project(other_actor,event_project,'private','Review idea');
  PERFORM public.manage_project(other_actor,event_project,'unlisted','Approve idea without progress or links');
  PERFORM public.manage_project(other_actor,event_project,'public','Publish idea without progress or links');
  RESET ROLE;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=event_project AND visibility='public' AND progress IS NULL) THEN
    RAISE EXCEPTION 'Hackathon idea could not be published without progress';
  END IF;
  UPDATE public.hackathons SET document=jsonb_set(document,'{submission_deadline}',to_jsonb(clock_timestamp()-interval '1 day')) WHERE id=hackathon;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(actor,event_project,'en','{"title":"Late edit"}');
    RAISE EXCEPTION 'Late translation saved';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:submission_deadline_passed%' THEN RAISE; END IF; END;
  IF has_function_privilege('authenticated','public.reserve_project_translation(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Browser can bypass translation authorization';
  END IF;
  DELETE FROM public.projects WHERE id IN (project,event_project);
  DELETE FROM public.hackathons WHERE id=hackathon;
  DELETE FROM auth.users WHERE id IN (actor,other_actor);
END;
$test$;
