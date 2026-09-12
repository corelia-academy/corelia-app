-- Practice artifacts belong to the single course final assignment.
CREATE FUNCTION private.learning_practice_final_errors(config jsonb, course_data jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF config IS NULL THEN RETURN '{}'; END IF;
 IF jsonb_typeof(config->'submission_fields') NOT IN ('array') THEN RETURN ARRAY['invalid_config']; END IF;
 IF config->>'mode' IN ('submission','guided_project') OR COALESCE(jsonb_array_length(config->'submission_fields'),0)>0 THEN
   IF NULLIF(btrim(course_data->>'final_assignment_title'),'') IS NULL THEN RETURN ARRAY['final_assignment_required']; END IF;
   IF COALESCE(jsonb_array_length(config->'submission_fields'),0)>0 AND (
     jsonb_typeof(course_data->'final_assignment_fields') IS DISTINCT FROM 'array'
     OR NOT (course_data->'final_assignment_fields' @> config->'submission_fields')
   ) THEN RETURN ARRAY['invalid_final_artifact_mapping']; END IF;
 END IF;
 RETURN '{}';
END $$;
REVOKE ALL ON FUNCTION private.learning_practice_final_errors(jsonb,jsonb) FROM PUBLIC;

-- Malformed legacy arrays are validation issues, not report-wide SQL failures.
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
   -- A project-template subsystem is deliberately not introduced.
   IF NULLIF(c->>'related_project_template_id','') IS NOT NULL THEN errors:=array_append(errors,'project_template_unavailable'); END IF;
 END IF;
 errors:=errors||private.learning_resource_errors(p_data->'resources');
 FOR c IN SELECT data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=p_id LOOP
   errors:=errors||private.learning_resource_errors(c->'resources');
 END LOOP;
 IF f='practice' THEN
   errors:=errors||private.learning_practice_final_errors(p_data->'practice_config',(SELECT data FROM public.courses WHERE id=p_course));
 END IF;
 RETURN errors;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN RETURN ARRAY['invalid_config'];
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_errors(text,jsonb,text) FROM PUBLIC;

-- Serialize lesson changes with course settings edits so both sides see the contract.
CREATE FUNCTION private.learning_lesson_course_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.courses WHERE id=NEW.course_id OR id=CASE WHEN TG_OP='UPDATE' THEN OLD.course_id END ORDER BY id FOR UPDATE;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_course_lock() FROM PUBLIC;
CREATE TRIGGER learning_lesson_course_lock BEFORE INSERT OR UPDATE ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION private.learning_lesson_course_lock();

-- A published lesson stays valid even if its containing course is still draft.
CREATE FUNCTION private.learning_final_mapping_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lesson record; course_data jsonb; errors text[]; BEGIN
 SELECT data INTO course_data FROM public.courses WHERE id=NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 FOR lesson IN SELECT id,data FROM public.course_lessons WHERE course_id=NEW.id AND published AND archived_at IS NULL AND data->>'lesson_format'='practice' LOOP
   errors:=private.learning_practice_final_errors(lesson.data->'practice_config',course_data);
   IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',lesson.id,array_to_string(errors,','); END IF;
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.learning_final_mapping_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER learning_final_mapping AFTER UPDATE OF data ON public.courses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_final_mapping_guard();
