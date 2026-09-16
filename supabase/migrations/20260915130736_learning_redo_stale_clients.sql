-- A completion after a reset must come from a client that knows the new run.
-- Old upserts omit this nonce; quiz completion remains guarded by a passed attempt.
ALTER TABLE public.lesson_progress ADD COLUMN completion_nonce uuid;

CREATE FUNCTION private.learning_redo_completion_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE format text; BEGIN
 IF auth.uid() IS NULL OR NEW.reset_epoch=0 OR NEW.completed_at IS NULL
    OR (TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT data->>'lesson_format' INTO format FROM public.course_lessons
 WHERE id=NEW.lesson_id AND course_id=NEW.course_id;
 IF format IS DISTINCT FROM 'quiz' AND (NEW.completion_nonce IS NULL
    OR (TG_OP='UPDATE' AND NEW.completion_nonce IS NOT DISTINCT FROM OLD.completion_nonce)) THEN
   RAISE EXCEPTION 'STALE_LESSON_ATTEMPT' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_redo_completion_guard() FROM PUBLIC;
CREATE TRIGGER learning_redo_completion_guard BEFORE INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION private.learning_redo_completion_guard();

-- The quiz completion INSERT runs its BEFORE INSERT guard before ON CONFLICT.
-- Its inserted row must therefore carry the run that produced the pass.
CREATE OR REPLACE FUNCTION private.learning_quiz_submit(p_course text, p_lesson text, p_request uuid, p_answers jsonb, p_epoch integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE u uuid:=auth.uid(); l public.course_lessons%ROWTYPE; q public.course_section_questions%ROWTYPE; total integer; correct integer:=0; threshold numeric; answer integer; rows jsonb; pass boolean; epoch integer;
BEGIN
 IF u IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_course||':'||p_lesson,0));
 SELECT * INTO l FROM public.course_lessons WHERE id=p_lesson AND course_id=p_course FOR SHARE;
 IF NOT FOUND OR NOT private.learning_lesson_visible(p_course,p_lesson) OR l.data->>'lesson_format'<>'quiz' THEN RAISE EXCEPTION 'LESSON_UNAVAILABLE'; END IF;
 SELECT COALESCE(max(reset_epoch),0) INTO epoch FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson;
 IF p_epoch IS DISTINCT FROM epoch THEN RAISE EXCEPTION 'STALE_LESSON_ATTEMPT' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.section_question_attempts WHERE user_id=u AND attempt_group_id=p_request AND (course_id<>p_course OR lesson_id IS DISTINCT FROM p_lesson OR reset_epoch<>epoch)) THEN RAISE EXCEPTION 'REQUEST_SCOPE_MISMATCH'; END IF;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.question_id),max(group_total),max(group_correct),max(passing_ratio) INTO rows,total,correct,threshold FROM public.section_question_attempts a WHERE user_id=u AND attempt_group_id=p_request AND reset_epoch=epoch;
 IF rows IS NOT NULL THEN
   RETURN jsonb_build_object('attempt_group_id',p_request,'total',total,'correct',correct,'passing_ratio',threshold,'passed',correct::numeric/total>=threshold,'attempts',rows,'completed',EXISTS(SELECT 1 FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson AND completed_at IS NOT NULL));
 END IF;

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
   INSERT INTO public.section_question_attempts(user_id,course_id,lesson_id,section_id,question_id,selected_index,is_correct,attempt_group_id,passing_ratio,reset_epoch)
   VALUES(u,p_course,p_lesson,NULL,q.id,answer,answer=(q.data->>'correct_index')::integer,p_request,threshold,epoch);
 END LOOP;
 UPDATE public.section_question_attempts SET group_total=total,group_correct=correct WHERE user_id=u AND attempt_group_id=p_request AND reset_epoch=epoch;
 pass:=correct::numeric/total>=threshold;
 INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at) VALUES(u::text||'_'||p_course,u,p_course,now(),now()) ON CONFLICT(user_id,course_id) DO NOTHING;
 IF pass THEN
   INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at,reset_epoch)
   VALUES(u::text||'_'||p_course||'_'||p_lesson,u,p_course,p_lesson,now(),epoch)
   ON CONFLICT(id) DO UPDATE SET completed_at=COALESCE(public.lesson_progress.completed_at,EXCLUDED.completed_at);
   PERFORM private.learning_sync_completion(p_course,u);
 END IF;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.question_id) INTO rows FROM public.section_question_attempts a WHERE user_id=u AND attempt_group_id=p_request AND reset_epoch=epoch;
 RETURN jsonb_build_object('attempt_group_id',p_request,'total',total,'correct',correct,'passing_ratio',threshold,'passed',pass,'attempts',rows,'completed',EXISTS(SELECT 1 FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson AND completed_at IS NOT NULL));
END $function$;

-- Legacy progress IDs are not always the deterministic ID used by current clients.
-- Align every row for a lesson so an older completed row cannot survive a reset.
CREATE OR REPLACE FUNCTION private.learning_reset_lesson(p_course text,p_lesson text,p_clear boolean,p_epoch integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); l public.course_lessons%ROWTYPE; row public.lesson_progress%ROWTYPE;
        epoch integer; draft integer; canonical text; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_course||':'||p_lesson,0));
 SELECT * INTO l FROM public.course_lessons WHERE id=p_lesson AND course_id=p_course FOR SHARE;
 IF NOT FOUND OR NOT private.learning_lesson_visible(p_course,p_lesson) THEN
   RAISE EXCEPTION 'LESSON_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(max(reset_epoch),0),COALESCE(max(draft_epoch),0) INTO epoch,draft
 FROM public.lesson_progress WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson;
 IF p_epoch IS DISTINCT FROM epoch THEN RAISE EXCEPTION 'STALE_LESSON_ATTEMPT' USING ERRCODE='42501'; END IF;
 canonical:=u::text||'_'||p_course||'_'||p_lesson;
 INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at,reset_epoch,draft_epoch)
 VALUES(canonical,u,p_course,p_lesson,NULL,epoch,draft) ON CONFLICT(id) DO NOTHING;
 UPDATE public.lesson_progress SET completed_at=NULL,reset_epoch=epoch+1,
   draft_epoch=draft+CASE WHEN p_clear THEN 1 ELSE 0 END
 WHERE user_id=u AND course_id=p_course AND lesson_id=p_lesson;
 SELECT * INTO row FROM public.lesson_progress WHERE id=canonical;
 IF NOT FOUND OR row.user_id<>u OR row.course_id<>p_course OR row.lesson_id<>p_lesson THEN
   RAISE EXCEPTION 'PROGRESS_IDENTITY_COLLISION' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('progress',to_jsonb(row),'reset_epoch',row.reset_epoch,'cleared',p_clear);
END $$;
