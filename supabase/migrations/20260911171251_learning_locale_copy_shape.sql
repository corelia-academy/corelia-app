-- Validate display-only JSON without changing machine config or historical rows.
CREATE FUNCTION private.learning_locale_copy_valid(d jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb; item jsonb; field text; BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF d ? 'video_primary_locale' AND (jsonb_typeof(d->'video_primary_locale') IS DISTINCT FROM 'string' OR d->>'video_primary_locale' NOT IN ('vi','en')) THEN RETURN false; END IF;
 IF d ? 'has_subtitle' AND jsonb_typeof(d->'has_subtitle') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
 IF d ? 'subtitle_locales' THEN
  IF jsonb_typeof(d->'subtitle_locales') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(d->'subtitle_locales') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR item#>>'{}' NOT IN ('vi','en') THEN RETURN false; END IF;
  END LOOP;
 END IF;
 IF NOT d ? 'code_exercise_locale' THEN RETURN true; END IF;
 c:=d->'code_exercise_locale';
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF c ? 'instructions' AND jsonb_typeof(c->'instructions') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 IF c ? 'hints' THEN
  IF jsonb_typeof(c->'hints') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(c->'hints') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
 END IF;
 IF c ? 'blank_feedback' THEN
  IF jsonb_typeof(c->'blank_feedback') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(c->'blank_feedback') x WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
 END IF;
 IF c ? 'test_copy' THEN
  IF jsonb_typeof(c->'test_copy') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_each(c->'test_copy') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   FOREACH field IN ARRAY ARRAY['description','failure_message','hint'] LOOP
    IF item ? field AND jsonb_typeof(item->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.learning_locale_copy_valid(jsonb) FROM PUBLIC;

CREATE FUNCTION private.learning_locale_copy_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lesson_id_value text; locale_value text; BEGIN
 IF TG_TABLE_NAME='course_lessons' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.data IS NOT DISTINCT FROM OLD.data AND (NOT NEW.published OR NEW.archived_at IS NOT NULL) THEN RETURN NEW; END IF;
  END IF;
  lesson_id_value:=NEW.id;
  SELECT COALESCE(data->'i18n'->>'primary_content_locale','vi') INTO locale_value FROM public.courses WHERE id=NEW.course_id;
 ELSE lesson_id_value:=NEW.lesson_id; locale_value:=NEW.locale;
 END IF;
 IF NOT private.learning_locale_copy_valid(NEW.data) THEN
  RAISE EXCEPTION 'INVALID_LOCALE_COPY' USING DETAIL=jsonb_build_object('issues',jsonb_build_array(jsonb_build_object('lessonId',lesson_id_value,'locale',locale_value,'panel','content','field','locale_copy','fieldPath',jsonb_build_array('locale_copy'),'code','invalid_locale_copy')))::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_locale_copy_guard() FROM PUBLIC;
CREATE TRIGGER learning_locale_copy_shape BEFORE INSERT OR UPDATE ON public.course_lessons FOR EACH ROW EXECUTE FUNCTION private.learning_locale_copy_guard();
CREATE TRIGGER learning_locale_copy_shape BEFORE INSERT OR UPDATE ON public.course_lesson_locales FOR EACH ROW EXECUTE FUNCTION private.learning_locale_copy_guard();

CREATE OR REPLACE FUNCTION private.learning_lesson_errors(p_id text,p_data jsonb,p_course text) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE errors text[]:='{}'; f text; c jsonb; step jsonb; field text; BEGIN
 IF COALESCE(btrim(p_data->>'title'),'')='' THEN errors:=array_append(errors,'title_required'); END IF;
 f:=COALESCE(p_data->>'lesson_format',CASE WHEN COALESCE(btrim(p_data->>'youtube_url'),'')<>'' THEN 'video' ELSE 'article' END);
 IF f='video' THEN
   IF COALESCE(p_data->>'youtube_url','') !~ '^https://((www\.|m\.)?youtube\.com/(watch\?[^ ]*v=|embed/|shorts/)|youtu\.be/)[a-zA-Z0-9_-]{11}' THEN errors:=array_append(errors,'youtube_required'); END IF;
   IF COALESCE((p_data->>'youtube_start_seconds')::numeric,0)<0 OR (p_data->>'youtube_end_seconds' IS NOT NULL AND (p_data->>'youtube_end_seconds')::numeric<=COALESCE((p_data->>'youtube_start_seconds')::numeric,0)) THEN errors:=array_append(errors,'invalid_segment'); END IF;
 ELSIF f='quiz' THEN
   IF COALESCE((p_data->'quiz_config'->>'passing_ratio')::numeric,0.7) NOT BETWEEN 0.01 AND 1 THEN errors:=array_append(errors,'invalid_threshold'); END IF;
   IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL) OR EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL AND (COALESCE(btrim(data->>'question'),'')='' OR jsonb_typeof(data->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(data->'options')<2 OR COALESCE(data->>'correct_index','')!~'^[0-9]+$' OR (data->>'correct_index')::integer>=jsonb_array_length(data->'options'))) THEN errors:=array_append(errors,'invalid_questions'); END IF;
 ELSIF f='code_exercise' THEN errors:=errors||private.learning_code_errors(p_data->'code_exercise_config');
 ELSIF f IN ('article','practice') THEN
   IF COALESCE(btrim(p_data->>'description_markdown'),'')='' THEN errors:=array_append(errors,'content_required'); END IF;
 ELSE errors:=array_append(errors,'invalid_format'); END IF;
 IF f='practice' THEN
   c:=COALESCE(p_data->'practice_config','{"mode":"instruction"}');
   IF COALESCE(c->>'mode','') NOT IN ('instruction','checklist','submission','guided_project') THEN errors:=array_append(errors,'invalid_practice'); END IF;
   IF COALESCE((c->>'requires_review')::boolean,false) THEN errors:=array_append(errors,'course_review_only'); END IF;
   IF c->>'mode'='checklist' AND (jsonb_array_length(COALESCE(c->'checklist_items','[]'))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(c->'checklist_items') x WHERE COALESCE(x->>'id','')='' OR COALESCE(btrim(x->>'label'),'')='')) THEN errors:=array_append(errors,'invalid_checklist'); END IF;
   IF c->>'mode'='guided_project' THEN
     IF jsonb_array_length(COALESCE(c->'project_steps','[]'))=0 THEN errors:=array_append(errors,'invalid_steps'); END IF;
     FOR step IN SELECT value FROM jsonb_array_elements(COALESCE(c->'project_steps','[]')) LOOP
       IF COALESCE(step->>'id','')='' OR COALESCE(btrim(step->>'title'),'')='' OR COALESCE(step->>'verification','') NOT IN ('self_check','artifact_required') THEN errors:=array_append(errors,'invalid_steps'); END IF;
       IF step->>'verification'='artifact_required' AND (jsonb_array_length(COALESCE(step->'artifact_fields','[]'))=0 OR NOT (COALESCE(c->'submission_fields','[]') @> (step->'artifact_fields'))) THEN errors:=array_append(errors,'invalid_artifact_mapping'); END IF;
     END LOOP;
   END IF;
   FOR field IN SELECT jsonb_array_elements_text(COALESCE(c->'submission_fields','[]')) LOOP
     IF field NOT IN ('github_url','deployment_url','contract_address','transaction_url','demo_url','notes') THEN errors:=array_append(errors,'invalid_artifact'); END IF;
   END LOOP;
   IF NULLIF(c->>'related_hackathon_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hackathons WHERE id=c->>'related_hackathon_id' AND status IN ('published','running','ended')) THEN errors:=array_append(errors,'invalid_related_hackathon'); END IF;
   IF NULLIF(c->>'related_project_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id::text=c->>'related_project_id' AND visibility='public' AND NOT blocked) THEN errors:=array_append(errors,'invalid_related_project'); END IF;
   -- A project-template subsystem is deliberately not introduced.
   IF NULLIF(c->>'related_project_template_id','') IS NOT NULL THEN errors:=array_append(errors,'project_template_unavailable'); END IF;
 END IF;
 IF NOT private.learning_locale_copy_valid(p_data) THEN errors:=array_append(errors,'invalid_locale_copy'); END IF;
 errors:=errors||private.learning_resource_errors(p_data->'resources');
 FOR c IN SELECT data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=p_id LOOP
   IF NOT private.learning_locale_copy_valid(c) THEN errors:=array_append(errors,'invalid_locale_copy'); END IF;
   errors:=errors||private.learning_resource_errors(c->'resources');
 END LOOP;
 IF f='practice' THEN
   errors:=errors||private.learning_practice_final_errors(p_data->'practice_config',(SELECT data FROM public.courses WHERE id=p_course));
 END IF;
 RETURN errors;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN RETURN ARRAY['invalid_config'];
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_errors(text,jsonb,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.learning_lesson_issues(p_course text, p_id text, p_data jsonb, primary_locale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE issues jsonb:='[]'; code text; loc record; format text; BEGIN
 format:=COALESCE(p_data->>'lesson_format',CASE WHEN NULLIF(p_data->>'youtube_url','') IS NOT NULL THEN 'video' ELSE 'article' END);
 FOREACH code IN ARRAY private.learning_lesson_errors(p_id,p_data,p_course) LOOP
  IF code NOT IN ('invalid_resources','resource_title_required','resource_url_invalid','invalid_locale_copy') THEN issues:=issues||jsonb_build_array(private.learning_issue_location(code,p_id,primary_locale,format)); END IF;
 END LOOP;
 IF NOT private.learning_locale_copy_valid(p_data) THEN issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',p_id,'locale',primary_locale,'panel','content','field','locale_copy','fieldPath',jsonb_build_array('locale_copy'),'code','invalid_locale_copy')); END IF;
 issues:=issues||private.learning_resource_issues(p_data->'resources',p_id,primary_locale);
 FOR loc IN SELECT locale,data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=p_id ORDER BY locale LOOP
  IF NOT private.learning_locale_copy_valid(loc.data) THEN issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',p_id,'locale',loc.locale,'panel','content','field','locale_copy','fieldPath',jsonb_build_array('locale_copy'),'code','invalid_locale_copy')); END IF;
  IF loc.locale<>primary_locale OR loc.data->'resources' IS DISTINCT FROM p_data->'resources' THEN
   issues:=issues||private.learning_resource_issues(loc.data->'resources',p_id,loc.locale);
  END IF;
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_issues(text,text,jsonb,text) FROM PUBLIC,anon;

