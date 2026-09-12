-- AUD-03/AUD-07: validate final payloads before writing and preserve attachment bytes.
-- Existing submissions and object paths are deliberately untouched.
CREATE FUNCTION private.learning_safe_url(value text, https_only boolean DEFAULT true) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE authority text; port text;
BEGIN
 IF value IS NULL OR value<>btrim(value) OR value ~ '[[:space:]\\]' THEN RETURN false; END IF;
 IF https_only AND value !~ '^https://' THEN RETURN false; END IF;
 authority:=substring(value FROM '^https?://([^/?#]+)');
 IF authority IS NULL OR authority !~ '^(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9_.-]+)(:[0-9]{1,5})?$' THEN RETURN false; END IF;
 port:=substring(authority FROM ':([0-9]+)$');
 RETURN port IS NULL OR port::integer<=65535;
END $$;
REVOKE ALL ON FUNCTION private.learning_safe_url(text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.learning_final_submit(p_course text, p_content text, p_files jsonb, p_artifacts jsonb, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); previous public.final_assignment_submissions%ROWTYPE; saved public.final_assignment_submissions%ROWTYPE; c jsonb; field text; val text;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST_ID'; END IF;
 IF u IS NULL OR NOT private.learning_course_visible(p_course) THEN RAISE EXCEPTION 'COURSE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_course||':final',0));
 SELECT * INTO saved FROM public.final_assignment_submissions WHERE id=p_request::text;
 IF FOUND THEN IF saved.user_id<>u OR saved.course_id<>p_course THEN RAISE EXCEPTION 'REQUEST_SCOPE_MISMATCH'; END IF; RETURN to_jsonb(saved); END IF;
 SELECT data INTO c FROM public.courses WHERE id=p_course FOR SHARE;
 IF NULLIF(btrim(c->>'final_assignment_title'),'') IS NULL THEN RAISE EXCEPTION 'FINAL_ASSIGNMENT_DISABLED'; END IF;
 SELECT * INTO previous FROM public.final_assignment_submissions WHERE user_id=u AND course_id=p_course ORDER BY submitted_at DESC,id DESC LIMIT 1;
 IF FOUND AND previous.status<>'rejected' THEN RAISE EXCEPTION 'SUBMISSION_ALREADY_EXISTS'; END IF;
 IF p_content IS NULL OR jsonb_typeof(p_artifacts) IS DISTINCT FROM 'object' OR jsonb_typeof(p_files) IS DISTINCT FROM 'array' OR length(p_content)>65536 OR (btrim(p_content)='' AND p_artifacts='{}'::jsonb) THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_artifacts) a WHERE a.key NOT IN ('github_url','deployment_url','contract_address','transaction_url','demo_url','notes') OR jsonb_typeof(a.value) IS DISTINCT FROM 'string')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_files) f WHERE jsonb_typeof(f) IS DISTINCT FROM 'string' OR NOT private.learning_safe_url(f#>>'{}',false)) THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 FOR field,val IN SELECT key,btrim(value#>>'{}') FROM jsonb_each(p_artifacts) LOOP
   IF field LIKE '%_url' AND val<>'' AND NOT private.learning_safe_url(val,true) THEN RAISE EXCEPTION 'INVALID_ARTIFACT: %',field; END IF;
 END LOOP;
 FOR field IN SELECT jsonb_array_elements_text(COALESCE(c->'final_assignment_fields','[]')) LOOP
   val:=btrim(COALESCE(p_artifacts->>field,''));
   IF val='' THEN RAISE EXCEPTION 'ARTIFACT_REQUIRED: %',field; END IF;
   IF field LIKE '%_url' AND NOT private.learning_safe_url(val,true) THEN RAISE EXCEPTION 'INVALID_ARTIFACT: %',field; END IF;
 END LOOP;
 INSERT INTO public.final_assignment_submissions(id,user_id,course_id,content,file_urls,status,submitted_at,artifacts)
 VALUES(p_request::text,u,p_course,p_content,p_files,'pending',clock_timestamp(),p_artifacts) RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $function$;

-- Final uploads use unique paths; neither learners nor reviewers may replace history.
DROP POLICY IF EXISTS storage_final_submissions_update ON storage.objects;
DROP POLICY IF EXISTS storage_final_submissions_delete ON storage.objects;
-- Restrictive policies also prevent unrelated permissive policies from reopening this prefix.
CREATE POLICY learning_final_files_immutable_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (NOT (bucket_id='app' AND (storage.foldername(name))[1]='final-assignment-submissions'))
 WITH CHECK (NOT (bucket_id='app' AND (storage.foldername(name))[1]='final-assignment-submissions'));
CREATE POLICY learning_final_files_immutable_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (NOT (bucket_id='app' AND (storage.foldername(name))[1]='final-assignment-submissions'));

CREATE FUNCTION private.learning_practice_shape_valid(c jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE item jsonb; step jsonb; field text;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR COALESCE(c->>'mode','') NOT IN ('instruction','checklist','submission','guided_project') OR NOT c ? 'mode' THEN RETURN false; END IF;
 IF c ? 'revision' AND (jsonb_typeof(c->'revision') IS DISTINCT FROM 'number' OR (c->>'revision')::numeric<>trunc((c->>'revision')::numeric) OR (c->>'revision')::numeric NOT BETWEEN 1 AND 9007199254740991) THEN RETURN false; END IF;
 IF c ? 'requires_review' AND jsonb_typeof(c->'requires_review') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['related_hackathon_id','related_project_id','related_project_template_id'] LOOP
  IF c ? field AND jsonb_typeof(c->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['checklist_items','project_steps','submission_fields'] LOOP
  IF NOT c ? field THEN CONTINUE; END IF;
  IF jsonb_typeof(c->field) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(c->field) LOOP
   IF field='submission_fields' THEN
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR item#>>'{}' NOT IN ('github_url','deployment_url','contract_address','transaction_url','demo_url','notes') THEN RETURN false; END IF;
   ELSE
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    IF field='checklist_items' THEN
     IF jsonb_typeof(item->'label') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    ELSE
     IF jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'order') IS DISTINCT FROM 'number' OR COALESCE(item->>'verification','') NOT IN ('self_check','artifact_required') THEN RETURN false; END IF;
     IF item ? 'instructions_markdown' AND jsonb_typeof(item->'instructions_markdown') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
     IF item ? 'artifact_fields' THEN
      IF jsonb_typeof(item->'artifact_fields') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
      FOR step IN SELECT value FROM jsonb_array_elements(item->'artifact_fields') LOOP
       IF jsonb_typeof(step) IS DISTINCT FROM 'string' OR step#>>'{}' NOT IN ('github_url','deployment_url','contract_address','transaction_url','demo_url','notes') THEN RETURN false; END IF;
      END LOOP;
     END IF;
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.learning_practice_shape_valid(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.learning_locale_copy_valid(d jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE c jsonb; item jsonb; field text; copy_field text; entry jsonb; BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['title','short_description','description_markdown','youtube_url'] LOOP
  IF d ? field AND jsonb_typeof(d->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['youtube_start_seconds','youtube_end_seconds'] LOOP
  IF d ? field AND jsonb_typeof(d->field) IS DISTINCT FROM 'number' AND NOT (field='youtube_end_seconds' AND d->field='null'::jsonb) THEN RETURN false; END IF;
 END LOOP;
 FOREACH copy_field IN ARRAY ARRAY['practice_copy','question_copy'] LOOP
  IF NOT d ? copy_field THEN CONTINUE; END IF;
  IF jsonb_typeof(d->copy_field) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR entry IN SELECT value FROM jsonb_each(d->copy_field) LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   FOREACH field IN ARRAY CASE WHEN copy_field='practice_copy' THEN ARRAY['title','label','instructions_markdown'] ELSE ARRAY['question','explanation'] END LOOP
    IF entry ? field AND jsonb_typeof(entry->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   END LOOP;
   IF copy_field='question_copy' AND entry ? 'options' THEN
    IF jsonb_typeof(entry->'options') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(entry->'options') x WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
   END IF;
  END LOOP;
 END LOOP;

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
     IF COALESCE(item->>'url','')<>'' AND item->>'url' !~ '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION 'INVALID_RESOURCE_URL'; END IF;
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

