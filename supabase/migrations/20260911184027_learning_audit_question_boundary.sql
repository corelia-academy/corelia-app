-- AUD-01/AUD-02: the canonical question row is another JSON boundary, alongside locale copy.
CREATE FUNCTION private.learning_question_valid(d jsonb, published boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE options jsonb; option jsonb; answer numeric;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR COALESCE(d->>'type','mcq')<>'mcq' THEN RETURN false; END IF;
 IF d ? 'question' AND jsonb_typeof(d->'question') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 IF d ? 'explanation' AND jsonb_typeof(d->'explanation') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 options:=COALESCE(d->'options','[]');
 IF jsonb_typeof(options) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF d ? 'correct_index' AND jsonb_typeof(d->'correct_index') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
 answer:=COALESCE((d->>'correct_index')::numeric,0);
 IF answer<0 OR trunc(answer)<>answer THEN RETURN false; END IF;
 FOR option IN SELECT value FROM jsonb_array_elements(options) LOOP
  IF jsonb_typeof(option) IS DISTINCT FROM 'object' OR jsonb_typeof(option->'id') IS DISTINCT FROM 'string' OR COALESCE(option->>'id','')='' OR jsonb_typeof(option->'text') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  IF published AND btrim(option->>'text')='' THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(options) x GROUP BY x->>'id' HAVING count(*)>1) THEN RETURN false; END IF;
 RETURN NOT published OR (COALESCE(btrim(d->>'question'),'')<>'' AND jsonb_array_length(options)>=2 AND answer<jsonb_array_length(options));
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.learning_question_valid(jsonb,boolean) FROM PUBLIC;
CREATE FUNCTION private.learning_question_shape_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.data IS NOT DISTINCT FROM OLD.data AND NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NOT private.learning_question_valid(NEW.data,false) THEN
  RAISE EXCEPTION 'INVALID_QUESTIONS' USING DETAIL=jsonb_build_object('issues',jsonb_build_array(jsonb_build_object('lessonId',NEW.lesson_id,'panel','content','field','questions','fieldPath',jsonb_build_array('questions',NEW.id),'code','invalid_options')))::text;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_question_shape_guard() FROM PUBLIC;
CREATE TRIGGER learning_question_shape BEFORE INSERT OR UPDATE ON public.course_section_questions FOR EACH ROW EXECUTE FUNCTION private.learning_question_shape_guard();

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

CREATE OR REPLACE FUNCTION private.learning_quiz_submit(p_course text, p_lesson text, p_request uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); l public.course_lessons%ROWTYPE; q public.course_section_questions%ROWTYPE; total integer; correct integer:=0; threshold numeric; answer integer; rows jsonb; pass boolean;
BEGIN
 IF u IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_course||':'||p_lesson,0));
 SELECT * INTO l FROM public.course_lessons WHERE id=p_lesson AND course_id=p_course FOR SHARE;
 IF NOT FOUND OR NOT private.learning_lesson_visible(p_course,p_lesson) OR l.data->>'lesson_format'<>'quiz' THEN RAISE EXCEPTION 'LESSON_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.section_question_attempts WHERE user_id=u AND attempt_group_id=p_request AND (course_id<>p_course OR lesson_id IS DISTINCT FROM p_lesson)) THEN RAISE EXCEPTION 'REQUEST_SCOPE_MISMATCH'; END IF;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.question_id),max(group_total),max(group_correct),max(passing_ratio) INTO rows,total,correct,threshold FROM public.section_question_attempts a WHERE user_id=u AND attempt_group_id=p_request;
 IF rows IS NOT NULL THEN
   RETURN jsonb_build_object('attempt_group_id',p_request,'total',total,'correct',correct,'passing_ratio',threshold,'passed',correct::numeric/total>=threshold,'attempts',rows,'completed',EXISTS(SELECT 1 FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson AND completed_at IS NOT NULL));
 END IF;
 IF COALESCE((l.data->'quiz_config'->>'allow_retry')::boolean,true)=false AND EXISTS(SELECT 1 FROM public.section_question_attempts WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson) THEN RAISE EXCEPTION 'RETRY_DISABLED'; END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_ANSWERS'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_lesson AND course_id=p_course AND archived_at IS NULL AND NOT private.learning_question_valid(data,true)) THEN RAISE EXCEPTION 'INVALID_QUESTIONS'; END IF;
 SELECT count(*) INTO total FROM public.course_section_questions WHERE lesson_id=p_lesson AND course_id=p_course AND archived_at IS NULL;
 IF total=0 OR (SELECT count(*) FROM jsonb_object_keys(p_answers))<>total THEN RAISE EXCEPTION 'QUESTION_SET_CHANGED'; END IF;
 threshold:=COALESCE((l.data->'quiz_config'->>'passing_ratio')::numeric,0.7);
 IF threshold<0.01 OR threshold>1 THEN RAISE EXCEPTION 'INVALID_THRESHOLD'; END IF;
 correct:=0;
 FOR q IN SELECT * FROM public.course_section_questions WHERE lesson_id=p_lesson AND course_id=p_course AND archived_at IS NULL ORDER BY id FOR SHARE LOOP
   IF NOT p_answers ? q.id OR p_answers->>q.id !~ '^[0-9]+$' THEN RAISE EXCEPTION 'INVALID_ANSWER'; END IF;
   answer:=(p_answers->>q.id)::integer;
   IF jsonb_typeof(q.data->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(q.data->'options')<2 OR COALESCE(q.data->>'correct_index','') !~ '^[0-9]+$' OR (q.data->>'correct_index')::integer>=jsonb_array_length(q.data->'options') THEN RAISE EXCEPTION 'INVALID_QUESTION'; END IF;
   IF answer>=jsonb_array_length(q.data->'options') THEN RAISE EXCEPTION 'INVALID_ANSWER'; END IF;
   correct:=correct+CASE WHEN answer=(q.data->>'correct_index')::integer THEN 1 ELSE 0 END;
   INSERT INTO public.section_question_attempts(user_id,course_id,lesson_id,section_id,question_id,selected_index,is_correct,attempt_group_id,passing_ratio)
   VALUES(u,p_course,p_lesson,NULL,q.id,answer,answer=(q.data->>'correct_index')::integer,p_request,threshold);
 END LOOP;
 UPDATE public.section_question_attempts SET group_total=total,group_correct=correct WHERE user_id=u AND attempt_group_id=p_request;
 pass:=correct::numeric/total>=threshold;
 INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at) VALUES(u::text||'_'||p_course,u,p_course,now(),now()) ON CONFLICT(user_id,course_id) DO NOTHING;
 IF pass THEN
   INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES(u::text||'_'||p_course||'_'||p_lesson,u,p_course,p_lesson,now()) ON CONFLICT(id) DO UPDATE SET completed_at=COALESCE(public.lesson_progress.completed_at,EXCLUDED.completed_at);
   PERFORM private.learning_sync_completion(p_course,u);
 END IF;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.question_id) INTO rows FROM public.section_question_attempts a WHERE user_id=u AND attempt_group_id=p_request;
 RETURN jsonb_build_object('attempt_group_id',p_request,'total',total,'correct',correct,'passing_ratio',threshold,'passed',pass,'attempts',rows,'completed',EXISTS(SELECT 1 FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson AND completed_at IS NOT NULL));
END $function$;

