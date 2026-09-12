-- Validate references against existing public projects; preserve all previous checks.
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
