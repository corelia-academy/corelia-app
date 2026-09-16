-- Translation drafts contain only authored copy. Empty/missing video overrides inherit the master.
BEGIN;

CREATE FUNCTION private.learning_locale_video_issues(p_id text, p_locale text, master jsonb, copy jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE issues jsonb := '[]'; start_value numeric; end_value numeric;
BEGIN
 IF COALESCE(master->>'lesson_format',CASE WHEN COALESCE(btrim(master->>'youtube_url'),'')<>'' THEN 'video' ELSE 'article' END)<>'video'
    OR COALESCE(btrim(copy->>'youtube_url'),'')='' THEN RETURN issues; END IF;
 IF private.learning_youtube_id(copy->>'youtube_url') IS NULL THEN
  issues:=issues||jsonb_build_array(private.learning_issue_location('youtube_required',p_id,p_locale,'video'));
 END IF;
 IF (copy ? 'youtube_start_seconds' AND jsonb_typeof(copy->'youtube_start_seconds') IS DISTINCT FROM 'number')
    OR (copy ? 'youtube_end_seconds' AND jsonb_typeof(copy->'youtube_end_seconds') NOT IN ('number','null')) THEN
  RETURN issues||jsonb_build_array(private.learning_issue_location('invalid_segment',p_id,p_locale,'video'));
 END IF;
 start_value:=COALESCE((copy->>'youtube_start_seconds')::numeric,0);
 end_value:=(copy->>'youtube_end_seconds')::numeric;
 IF start_value<0 OR end_value<=start_value THEN
  issues:=issues||jsonb_build_array(private.learning_issue_location('invalid_segment',p_id,p_locale,'video'));
 END IF;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_locale_video_issues(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

-- Derived duration changes do not alter publication content. All other data/status edits retain the guard.
DROP TRIGGER learning_publication_update ON public.courses;
CREATE CONSTRAINT TRIGGER learning_publication_update AFTER UPDATE ON public.courses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
WHEN ((OLD.data-'total_duration_seconds') IS DISTINCT FROM (NEW.data-'total_duration_seconds')
 OR OLD.published IS DISTINCT FROM NEW.published OR OLD.archived_at IS DISTINCT FROM NEW.archived_at)
EXECUTE FUNCTION private.learning_publication_guard();

CREATE OR REPLACE FUNCTION private.learning_lesson_issues(p_course text, p_id text, p_data jsonb, primary_locale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE issues jsonb:='[]'; code text; loc record; format text; BEGIN
 format:=COALESCE(p_data->>'lesson_format',CASE WHEN COALESCE(btrim(p_data->>'youtube_url'),'')<>'' THEN 'video' WHEN COALESCE(btrim(p_data->>'description_markdown'),btrim(p_data->>'short_description'),'')<>'' THEN 'article' ELSE 'video' END);
 FOREACH code IN ARRAY private.learning_lesson_errors(p_id,p_data,p_course) LOOP
  IF code NOT IN ('invalid_resources','resource_title_required','resource_url_invalid','invalid_locale_copy') THEN issues:=issues||jsonb_build_array(private.learning_issue_location(code,p_id,primary_locale,format)); END IF;
 END LOOP;
 IF NOT private.learning_locale_copy_valid(p_data) THEN issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',p_id,'locale',primary_locale,'panel','content','field','locale_copy','fieldPath',jsonb_build_array('locale_copy'),'code','invalid_locale_copy')); END IF;
 issues:=issues||private.learning_resource_issues(p_data->'resources',p_id,primary_locale);
 FOR loc IN SELECT locale,data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=p_id ORDER BY locale LOOP
  IF loc.locale<>primary_locale THEN issues:=issues||private.learning_locale_video_issues(p_id,loc.locale,p_data,loc.data); END IF;
  IF NOT private.learning_locale_copy_valid(loc.data) THEN issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',p_id,'locale',loc.locale,'panel','content','field','locale_copy','fieldPath',jsonb_build_array('locale_copy'),'code','invalid_locale_copy')); END IF;
  IF loc.locale<>primary_locale OR loc.data->'resources' IS DISTINCT FROM p_data->'resources' THEN
   issues:=issues||private.learning_resource_issues(loc.data->'resources',p_id,loc.locale);
  END IF;
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_issues(text,text,jsonb,text) FROM PUBLIC,anon;


CREATE OR REPLACE FUNCTION private.learning_publication_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE errors text[]; issues jsonb; primary_locale text; l public.course_lessons%ROWTYPE; course_id_value text; d jsonb; BEGIN
 IF TG_TABLE_NAME='course_lessons' THEN
   SELECT * INTO l FROM public.course_lessons WHERE id=NEW.id AND course_id=NEW.course_id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   IF TG_OP='UPDATE' THEN
     IF l.data IS NOT DISTINCT FROM OLD.data AND (NOT l.published OR l.archived_at IS NOT NULL) THEN RETURN NULL; END IF;
   END IF;
   IF l.data->>'lesson_format'='code_exercise' THEN
     errors:=private.learning_code_errors(l.data->'code_exercise_config',false);
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'INVALID_CODE_CONFIG: %',array_to_string(errors,','); END IF;
   END IF;
   IF l.published AND l.archived_at IS NULL THEN
     SELECT COALESCE(data->'i18n'->>'primary_content_locale','vi') INTO primary_locale FROM public.courses WHERE id=l.course_id;
     issues:=private.learning_lesson_issues(l.course_id,l.id,l.data,primary_locale);
     errors:=ARRAY(SELECT value->>'code' FROM jsonb_array_elements(issues));
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',l.id,array_to_string(errors,',') USING DETAIL=jsonb_build_object('issues',issues)::text; END IF;
   END IF;
 ELSIF TG_TABLE_NAME IN ('course_section_questions','course_lesson_locales') THEN
   -- A move changes both curricula. Validate the source as well as destination.
   FOR l IN SELECT * FROM public.course_lessons WHERE published AND archived_at IS NULL AND (
     (course_id=CASE WHEN TG_OP<>'INSERT' THEN OLD.course_id END AND id=CASE WHEN TG_OP<>'INSERT' THEN OLD.lesson_id END)
     OR (course_id=CASE WHEN TG_OP<>'DELETE' THEN NEW.course_id END AND id=CASE WHEN TG_OP<>'DELETE' THEN NEW.lesson_id END)
   ) LOOP
     SELECT COALESCE(data->'i18n'->>'primary_content_locale','vi') INTO primary_locale FROM public.courses WHERE id=l.course_id;
     issues:=private.learning_lesson_issues(l.course_id,l.id,l.data,primary_locale);
     errors:=ARRAY(SELECT value->>'code' FROM jsonb_array_elements(issues));
     IF TG_TABLE_NAME='course_lesson_locales' AND TG_OP<>'DELETE' AND l.course_id=NEW.course_id AND l.id=NEW.lesson_id THEN
       -- Machine configuration belongs to the master, never locale records.
       IF NEW.data ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
       -- Required source text stays on the master; partial translation copy is allowed.
       -- The structured validator above checks every localized resource/video override.
     END IF;
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',l.id,array_to_string(errors,',') USING DETAIL=jsonb_build_object('issues',issues)::text; END IF;
   END LOOP;
 ELSE
   course_id_value:=CASE WHEN TG_TABLE_NAME='courses' THEN to_jsonb(NEW)->>'id' ELSE to_jsonb(NEW)->>'course_id' END;
   SELECT data INTO d FROM public.courses WHERE id=course_id_value AND published AND archived_at IS NULL;
   IF FOUND THEN
     IF COALESCE(btrim(d->>'title'),'')='' OR NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL) THEN RAISE EXCEPTION 'COURSE_NOT_PUBLISHABLE'; END IF;
     IF NULLIF(btrim(d->>'final_assignment_title'),'') IS NOT NULL AND COALESCE(btrim(d->>'final_assignment_instructions'),'')='' THEN RAISE EXCEPTION 'FINAL_INSTRUCTIONS_REQUIRED'; END IF;
     FOR l IN SELECT * FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL LOOP
       SELECT COALESCE(data->'i18n'->>'primary_content_locale','vi') INTO primary_locale FROM public.courses WHERE id=l.course_id;
     issues:=private.learning_lesson_issues(l.course_id,l.id,l.data,primary_locale);
     errors:=ARRAY(SELECT value->>'code' FROM jsonb_array_elements(issues));
       IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',l.id,array_to_string(errors,',') USING DETAIL=jsonb_build_object('issues',issues)::text; END IF;
     END LOOP;
   END IF;
 END IF;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.learning_publication_guard() FROM PUBLIC;

-- Readiness includes drafts and reuses the same validator as publication enforcement.
CREATE OR REPLACE FUNCTION private.learning_curriculum_readiness(p_course text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN
   RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'lessonId',l.id,'issues',COALESCE((SELECT jsonb_agg(DISTINCT issue->>'code') FROM jsonb_array_elements(private.learning_lesson_issues(l.course_id,l.id,l.data,COALESCE(c.data->'i18n'->>'primary_content_locale','vi'))) issue),'[]'::jsonb))
   ORDER BY s.sort_order,l.sort_order,l.id)
 FROM public.course_lessons l JOIN public.courses c ON c.id=l.course_id LEFT JOIN public.course_sections s ON s.course_id=l.course_id AND s.id=l.section_id
 WHERE l.course_id=p_course AND l.archived_at IS NULL),'[]'::jsonb);
END $$;

-- Reject malformed explicit overrides on drafts too, preserving actionable locale locations.
CREATE FUNCTION private.learning_locale_video_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE master jsonb; primary_locale text; issues jsonb;
BEGIN
 SELECT l.data,COALESCE(c.data->'i18n'->>'primary_content_locale','vi') INTO master,primary_locale
 FROM public.course_lessons l JOIN public.courses c ON c.id=l.course_id
 WHERE l.course_id=NEW.course_id AND l.id=NEW.lesson_id;
 IF NEW.locale=primary_locale THEN RETURN NEW; END IF;
 issues:=private.learning_locale_video_issues(NEW.lesson_id,NEW.locale,master,NEW.data);
 IF jsonb_array_length(issues)>0 THEN
  RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',NEW.lesson_id,(SELECT string_agg(value->>'code',',') FROM jsonb_array_elements(issues))
  USING DETAIL=jsonb_build_object('issues',issues)::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_locale_video_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER learning_locale_video_shape BEFORE INSERT OR UPDATE ON public.course_lesson_locales
FOR EACH ROW EXECUTE FUNCTION private.learning_locale_video_guard();

-- Saving unrelated course settings must not materialize an untouched translation.
DO $$ DECLARE definition text; changed text; BEGIN
 definition:=pg_get_functiondef('public.learning_save_course_info(text,jsonb,text,jsonb)'::regprocedure);
 changed:=replace(definition,' INSERT INTO public.course_locales(course_id,locale,data)',E' IF p_copy<>''{}''::jsonb THEN\n INSERT INTO public.course_locales(course_id,locale,data)');
 changed:=replace(changed,' -- Deferred publication checks observe the final course + locale together.',E' END IF;\n -- Deferred publication checks observe the final course + locale together.');
 IF changed=definition THEN RAISE EXCEPTION 'Course save definition changed'; END IF;
 EXECUTE changed;
END $$;
COMMIT;
