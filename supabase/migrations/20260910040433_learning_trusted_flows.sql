-- Trusted, atomic quiz and final-assignment operations. No client-declared score.
ALTER TABLE public.section_question_attempts ADD COLUMN passing_ratio numeric;
ALTER TABLE public.section_question_attempts ADD COLUMN group_total integer;
ALTER TABLE public.section_question_attempts ADD COLUMN group_correct integer;

CREATE OR REPLACE FUNCTION public.corelia_certificate_readiness(p_course_id text,p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 WITH lessons AS (SELECT id FROM public.course_lessons WHERE course_id=p_course_id AND published AND archived_at IS NULL),
 counts AS (SELECT (SELECT count(*) FROM lessons) AS total, (SELECT count(DISTINCT p.lesson_id) FROM public.lesson_progress p JOIN lessons l ON l.id=p.lesson_id WHERE p.user_id=p_user_id AND p.course_id=p_course_id AND p.completed_at IS NOT NULL) AS done),
 final AS (SELECT status FROM public.final_assignment_submissions WHERE user_id=p_user_id AND course_id=p_course_id ORDER BY submitted_at DESC,id DESC LIMIT 1)
 SELECT jsonb_build_object('course_exists',EXISTS(SELECT 1 FROM public.courses WHERE id=p_course_id), 'lesson_total',total,'completed_distinct',done,'all_lessons_complete',total>0 AND done>=total,'final_assignment_required',EXISTS(SELECT 1 FROM public.courses WHERE id=p_course_id AND NULLIF(btrim(data->>'final_assignment_title'),'') IS NOT NULL),'final_submission_status',(SELECT status FROM final)) FROM counts;
$$;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.corelia_certificate_readiness(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.learning_sync_completion(p_course text,p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; BEGIN
 r := public.corelia_certificate_readiness(p_course,p_user);
 IF (r->>'all_lessons_complete')::boolean AND (NOT (r->>'final_assignment_required')::boolean OR r->>'final_submission_status'='approved') THEN
   UPDATE public.enrollments SET completed_at=clock_timestamp() WHERE course_id=p_course AND user_id=p_user AND completed_at IS NULL;
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.learning_sync_completion(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_enrollment_completion_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; BEGIN
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL THEN
   NEW.completed_at := OLD.completed_at; RETURN NEW;
 END IF;
 IF NEW.completed_at IS NOT NULL THEN
   r := public.corelia_certificate_readiness(NEW.course_id,NEW.user_id);
   IF NOT COALESCE((r->>'all_lessons_complete')::boolean,false) OR ((r->>'final_assignment_required')::boolean AND COALESCE(r->>'final_submission_status','')<>'approved') THEN RAISE EXCEPTION 'COURSE_NOT_COMPLETE'; END IF;
   NEW.completed_at := clock_timestamp();
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.learning_progress_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f text; BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.course_id<>OLD.course_id OR NEW.lesson_id<>OLD.lesson_id) THEN RAISE EXCEPTION 'PROGRESS_IDENTITY_IMMUTABLE'; END IF;
 IF auth.uid() IS NOT NULL AND NOT private.learning_lesson_visible(NEW.course_id,NEW.lesson_id) THEN RAISE EXCEPTION 'LESSON_UNAVAILABLE'; END IF;
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL THEN NEW.completed_at:=OLD.completed_at; RETURN NEW; END IF;
 SELECT data->>'lesson_format' INTO f FROM public.course_lessons WHERE id=NEW.lesson_id AND course_id=NEW.course_id;
 IF f='quiz' AND NEW.completed_at IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.section_question_attempts WHERE user_id=NEW.user_id AND lesson_id=NEW.lesson_id AND course_id=NEW.course_id AND attempt_group_id IS NOT NULL AND group_total>0 AND group_correct::numeric/group_total>=passing_ratio
 ) THEN RAISE EXCEPTION 'QUIZ_PASS_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NEW.completed_at IS NOT NULL THEN NEW.completed_at:=clock_timestamp(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_progress_guard() FROM PUBLIC;
CREATE TRIGGER learning_progress_guard BEFORE INSERT OR UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION private.learning_progress_guard();

CREATE OR REPLACE FUNCTION private.learning_quiz_submit(p_course text,p_lesson text,p_request uuid,p_answers jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
 IF COALESCE((l.data->'quiz_config'->>'allow_retry')::boolean,true)=false AND EXISTS(SELECT 1 FROM public.section_question_attempts WHERE user_id=u AND lesson_id=p_lesson) THEN RAISE EXCEPTION 'RETRY_DISABLED'; END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_ANSWERS'; END IF;
 SELECT count(*) INTO total FROM public.course_section_questions WHERE lesson_id=p_lesson AND course_id=p_course AND archived_at IS NULL;
 IF total=0 OR (SELECT count(*) FROM jsonb_object_keys(p_answers))<>total THEN RAISE EXCEPTION 'QUESTION_SET_CHANGED'; END IF;
 threshold:=COALESCE((l.data->'quiz_config'->>'passing_ratio')::numeric,0.7);
 IF threshold<=0 OR threshold>1 THEN RAISE EXCEPTION 'INVALID_THRESHOLD'; END IF;
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
END $$;
CREATE FUNCTION public.learning_quiz_submit(p_course text,p_lesson text,p_request uuid,p_answers jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_quiz_submit(p_course,p_lesson,p_request,p_answers); $$;
REVOKE ALL ON FUNCTION private.learning_quiz_submit(text,text,uuid,jsonb),public.learning_quiz_submit(text,text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_quiz_submit(text,text,uuid,jsonb),public.learning_quiz_submit(text,text,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.learning_final_submit(p_course text,p_content text,p_files jsonb,p_artifacts jsonb,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); previous public.final_assignment_submissions%ROWTYPE; saved public.final_assignment_submissions%ROWTYPE; c jsonb; field text; val text;
BEGIN
 IF u IS NULL OR NOT private.learning_course_visible(p_course) THEN RAISE EXCEPTION 'COURSE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_course||':final',0));
 SELECT * INTO saved FROM public.final_assignment_submissions WHERE id=p_request::text;
 IF FOUND THEN IF saved.user_id<>u OR saved.course_id<>p_course THEN RAISE EXCEPTION 'REQUEST_SCOPE_MISMATCH'; END IF; RETURN to_jsonb(saved); END IF;
 SELECT data INTO c FROM public.courses WHERE id=p_course FOR SHARE;
 IF NULLIF(btrim(c->>'final_assignment_title'),'') IS NULL THEN RAISE EXCEPTION 'FINAL_ASSIGNMENT_DISABLED'; END IF;
 SELECT * INTO previous FROM public.final_assignment_submissions WHERE user_id=u AND course_id=p_course ORDER BY submitted_at DESC,id DESC LIMIT 1;
 IF FOUND AND previous.status<>'rejected' THEN RAISE EXCEPTION 'SUBMISSION_ALREADY_EXISTS'; END IF;
 IF jsonb_typeof(p_artifacts) IS DISTINCT FROM 'object' OR jsonb_typeof(p_files) IS DISTINCT FROM 'array' OR length(p_content)>65536 OR (btrim(p_content)='' AND p_artifacts='{}'::jsonb) THEN RAISE EXCEPTION 'INVALID_SUBMISSION'; END IF;
 FOR field IN SELECT jsonb_array_elements_text(COALESCE(c->'final_assignment_fields','[]')) LOOP
   val:=btrim(COALESCE(p_artifacts->>field,''));
   IF val='' THEN RAISE EXCEPTION 'ARTIFACT_REQUIRED: %',field; END IF;
   IF field LIKE '%_url' AND val !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'INVALID_ARTIFACT: %',field; END IF;
 END LOOP;
 INSERT INTO public.final_assignment_submissions(id,user_id,course_id,content,file_urls,status,submitted_at,artifacts)
 VALUES(p_request::text,u,p_course,p_content,p_files,'pending',clock_timestamp(),p_artifacts) RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $$;
CREATE FUNCTION public.learning_final_submit(p_course text,p_content text,p_files jsonb,p_artifacts jsonb,p_request uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_final_submit(p_course,p_content,p_files,p_artifacts,p_request); $$;
REVOKE ALL ON FUNCTION private.learning_final_submit(text,text,jsonb,jsonb,uuid),public.learning_final_submit(text,text,jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_final_submit(text,text,jsonb,jsonb,uuid),public.learning_final_submit(text,text,jsonb,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.learning_final_review(p_submission text,p_status text,p_comment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.final_assignment_submissions%ROWTYPE; latest text; BEGIN
 IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'INVALID_REVIEW_STATUS'; END IF;
 SELECT * INTO s FROM public.final_assignment_submissions WHERE id=p_submission;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUBMISSION_NOT_FOUND'; END IF;
 IF NOT private.can_manage_course_feature(s.course_id,auth.uid(),'submissions') THEN RAISE EXCEPTION 'COURSE_REVIEW_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.user_id::text||':'||s.course_id||':final',0));
 SELECT id INTO latest FROM public.final_assignment_submissions WHERE user_id=s.user_id AND course_id=s.course_id ORDER BY submitted_at DESC,id DESC LIMIT 1;
 IF latest<>s.id THEN RAISE EXCEPTION 'STALE_SUBMISSION'; END IF;
 SELECT * INTO s FROM public.final_assignment_submissions WHERE id=p_submission FOR UPDATE;
 IF s.status=p_status THEN RETURN to_jsonb(s); END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'REVIEW_ALREADY_FINAL'; END IF;
 UPDATE public.final_assignment_submissions SET status=p_status,reviewer_comment=p_comment,reviewed_at=clock_timestamp() WHERE id=s.id RETURNING * INTO s;
 IF p_status='approved' THEN PERFORM private.learning_sync_completion(s.course_id,s.user_id); END IF;
 RETURN to_jsonb(s);
END $$;
CREATE FUNCTION public.learning_final_review(p_submission text,p_status text,p_comment text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_final_review(p_submission,p_status,p_comment); $$;
REVOKE ALL ON FUNCTION private.learning_final_review(text,text,text),public.learning_final_review(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_final_review(text,text,text),public.learning_final_review(text,text,text) TO authenticated;

-- Existing section quizzes remain available but cannot bypass lesson quiz policy.
CREATE OR REPLACE FUNCTION private.check_user_course_quiz_access(p_course_id text,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT p_user_id=auth.uid() AND private.learning_course_visible(p_course_id); $$;
CREATE OR REPLACE FUNCTION private.learning_attempt_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.lesson_id IS NOT NULL AND (NEW.attempt_group_id IS NULL OR NOT private.learning_lesson_visible(NEW.course_id,NEW.lesson_id)) THEN RAISE EXCEPTION 'USE_LEARNING_QUIZ_SUBMIT'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_attempt_guard() FROM PUBLIC;
CREATE TRIGGER learning_attempt_guard BEFORE INSERT ON public.section_question_attempts FOR EACH ROW EXECUTE FUNCTION private.learning_attempt_guard();

