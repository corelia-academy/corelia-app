-- AUD-02: resource draft and publication checks use the same authority validation as submission URLs.
CREATE OR REPLACE FUNCTION private.learning_resource_errors(resources jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE item jsonb; errors text[] := '{}';
BEGIN
 IF resources IS NULL THEN RETURN errors; END IF;
 IF jsonb_typeof(resources) IS DISTINCT FROM 'array' THEN RETURN ARRAY['invalid_resources']; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(resources) LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN
     errors:=array_append(errors,'invalid_resources'); CONTINUE;
   END IF;
   IF jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR COALESCE(btrim(item->>'title'),'')='' THEN
     errors:=array_append(errors,'resource_title_required');
   END IF;
   IF jsonb_typeof(item->'url') IS DISTINCT FROM 'string' OR NOT private.learning_safe_url(item->>'url',false) THEN
     errors:=array_append(errors,'resource_url_invalid');
   END IF;
 END LOOP;
 RETURN errors;
END $function$;

CREATE OR REPLACE FUNCTION private.learning_content_shape_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d jsonb:=NEW.data; c jsonb; item jsonb; field text;
BEGIN
 -- Metadata-only retirement must remain possible for pre-enforcement content.
 IF TG_TABLE_NAME='course_lessons' AND TG_OP='UPDATE' THEN
   IF NEW.data IS NOT DISTINCT FROM OLD.data AND (NOT NEW.published OR NEW.archived_at IS NOT NULL) THEN RETURN NEW; END IF;
 END IF;
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_CONTENT_OBJECT'; END IF;
 IF TG_TABLE_NAME='course_lesson_locales' AND d ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
 IF TG_TABLE_NAME='course_locales' AND d ?| ARRAY['instructors','has_certificate','final_assignment_fields','owner_type','co_instructor_permissions','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
 IF d ? 'resources' THEN
   IF jsonb_typeof(d->'resources') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_RESOURCES'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(d->'resources') LOOP
     IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'url') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_RESOURCE'; END IF;
     IF COALESCE(item->>'url','')<>'' AND NOT private.learning_safe_url(item->>'url',false) THEN RAISE EXCEPTION 'INVALID_RESOURCE_URL'; END IF;
   END LOOP;
 END IF;
 IF TG_TABLE_NAME='course_lessons' THEN
   IF d ? 'quiz_config' THEN
     c:=d->'quiz_config';
     IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (c ? 'allow_retry' AND jsonb_typeof(c->'allow_retry') IS DISTINCT FROM 'boolean') OR (c ? 'passing_ratio' AND jsonb_typeof(c->'passing_ratio') IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'INVALID_QUIZ_CONFIG'; END IF;
   END IF;
   IF d ? 'practice_config' THEN
     c:=d->'practice_config';
     IF NOT private.learning_practice_shape_valid(c) THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
     IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR COALESCE(c->>'mode','') NOT IN ('instruction','checklist','submission','guided_project') THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
     FOREACH field IN ARRAY ARRAY['checklist_items','project_steps','submission_fields'] LOOP
       IF c ? field AND jsonb_typeof(c->field) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
     END LOOP;
     IF c ? 'requires_review' AND jsonb_typeof(c->'requires_review') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $function$;

-- Match the URL forms supported by the existing player, with an exact video ID.
CREATE FUNCTION private.learning_youtube_id(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE parts text[]; path text; query text; candidate text; host text;
BEGIN
 value:=btrim(value);
 IF value IS NULL OR value ~ '[[:space:]\\]' THEN RETURN NULL; END IF;
 parts:=regexp_match(value,'^(?:https?://)?((?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com|music\.youtube\.com|youtube-nocookie\.com))(?::[0-9]{1,5})?([^?#]*)(?:\?([^#]*))?(?:#.*)?$','i');
 IF parts IS NULL THEN RETURN NULL; END IF;
 host:=lower(parts[1]); path:=parts[2]; query:=parts[3];
 IF host IN ('youtu.be','www.youtu.be') THEN candidate:=(regexp_match(path,'^/+([^/]+)'))[1];
 ELSIF path='/watch' THEN candidate:=(regexp_match(query,'(?:^|&)v=([^&]*)'))[1];
 ELSE candidate:=(regexp_match(path,'^/+(?:embed|shorts|live|v)/+([^/]+)'))[1]; END IF;
 IF candidate ~ '^[a-zA-Z0-9_-]{11}$' THEN RETURN candidate; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.learning_youtube_id(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.learning_lesson_errors(p_id text, p_data jsonb, p_course text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE errors text[]:='{}'; f text; c jsonb; step jsonb; field text; BEGIN
 IF COALESCE(btrim(p_data->>'title'),'')='' THEN errors:=array_append(errors,'title_required'); END IF;
 f:=COALESCE(p_data->>'lesson_format',CASE WHEN COALESCE(btrim(p_data->>'youtube_url'),'')<>'' THEN 'video' ELSE 'article' END);
 IF f='video' THEN
   IF private.learning_youtube_id(p_data->>'youtube_url') IS NULL THEN errors:=array_append(errors,'youtube_required'); END IF;
   IF COALESCE((p_data->>'youtube_start_seconds')::numeric,0)<0 OR (p_data->>'youtube_end_seconds' IS NOT NULL AND (p_data->>'youtube_end_seconds')::numeric<=COALESCE((p_data->>'youtube_start_seconds')::numeric,0)) THEN errors:=array_append(errors,'invalid_segment'); END IF;
 ELSIF f='quiz' THEN
   IF COALESCE((p_data->'quiz_config'->>'passing_ratio')::numeric,0.7) NOT BETWEEN 0.01 AND 1 THEN errors:=array_append(errors,'invalid_threshold'); END IF;
   IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL) OR EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL AND NOT private.learning_question_valid(data,true)) THEN errors:=array_append(errors,'invalid_questions'); END IF;
 ELSIF f='code_exercise' THEN errors:=errors||private.learning_code_errors(p_data->'code_exercise_config');
 ELSIF f IN ('article','practice') THEN
   IF COALESCE(btrim(p_data->>'description_markdown'),'')='' THEN errors:=array_append(errors,'content_required'); END IF;
 ELSE errors:=array_append(errors,'invalid_format'); END IF;
 IF f='practice' THEN
   c:=COALESCE(p_data->'practice_config','{"mode":"instruction"}');
   IF NOT private.learning_practice_shape_valid(c) THEN RETURN errors||ARRAY['invalid_config']; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c->'checklist_items','[]')) x GROUP BY x->>'id' HAVING count(*)>1) THEN errors:=array_append(errors,'invalid_checklist'); END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c->'project_steps','[]')) x GROUP BY x->>'id' HAVING count(*)>1) THEN errors:=array_append(errors,'invalid_steps'); END IF;
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
END $function$;
