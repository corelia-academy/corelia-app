-- Atomic authoring reuses canonical tables, preserving question/attempt IDs.
CREATE FUNCTION private.learning_save_lesson(p_course text,p_lesson jsonb,p_questions jsonb DEFAULT NULL,p_locales jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.course_lessons%ROWTYPE; saved public.course_lessons%ROWTYPE; q jsonb; loc record; lesson_id_value text:=p_lesson->>'id'; section_id_value text:=p_lesson->>'section_id'; body jsonb; old_config jsonb; new_config jsonb; machine_old jsonb; machine_new jsonb; old_data jsonb;
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 IF NULLIF(lesson_id_value,'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.course_sections WHERE id=section_id_value AND course_id=p_course) THEN RAISE EXCEPTION 'INVALID_LESSON_REFERENCE'; END IF;
 SELECT * INTO l FROM public.course_lessons WHERE id=lesson_id_value AND course_id=p_course FOR UPDATE;
 IF FOUND AND l.course_id<>p_course THEN RAISE EXCEPTION 'LESSON_SCOPE_MISMATCH'; END IF;
 body:=p_lesson-ARRAY['id','section_id','order','published','archived_at','code_exercise_locale','practice_copy','question_copy'];
 IF l.id IS NOT NULL AND l.data->>'lesson_format' IS DISTINCT FROM body->>'lesson_format' AND NOT (COALESCE(l.data->>'lesson_format','article') IN ('article','video') AND body->>'lesson_format' IN ('article','video')) THEN RAISE EXCEPTION 'CREATE_NEW_LESSON_FOR_FORMAT_CHANGE'; END IF;
 IF body->>'lesson_format'='code_exercise' THEN
   old_config:=l.data->'code_exercise_config'; new_config:=body->'code_exercise_config';
   -- Display-only edits do not invalidate learner drafts.
   machine_old:=old_config-ARRAY['revision','hints']; machine_new:=new_config-ARRAY['revision','hints'];
   SELECT jsonb_set(machine_old,'{blanks}',COALESCE(jsonb_agg(x- 'feedback'),'[]')) INTO machine_old FROM jsonb_array_elements(COALESCE(old_config->'blanks','[]')) x;
   SELECT jsonb_set(machine_new,'{blanks}',COALESCE(jsonb_agg(x- 'feedback'),'[]')) INTO machine_new FROM jsonb_array_elements(COALESCE(new_config->'blanks','[]')) x;
   SELECT jsonb_set(machine_old,'{tests}',COALESCE(jsonb_agg(x-ARRAY['description','failure_message','hint']),'[]')) INTO machine_old FROM jsonb_array_elements(COALESCE(old_config->'tests','[]')) x;
   SELECT jsonb_set(machine_new,'{tests}',COALESCE(jsonb_agg(x-ARRAY['description','failure_message','hint']),'[]')) INTO machine_new FROM jsonb_array_elements(COALESCE(new_config->'tests','[]')) x;
   body:=jsonb_set(body,'{code_exercise_config,revision}',to_jsonb(CASE WHEN old_config IS NULL THEN 1 ELSE COALESCE((old_config->>'revision')::int,1)+CASE WHEN machine_old IS DISTINCT FROM machine_new THEN 1 ELSE 0 END END));
 END IF;
 IF body->>'lesson_format'='practice' AND body ? 'practice_config' THEN
   body:=jsonb_set(body,'{practice_config,revision}',to_jsonb(COALESCE((l.data->'practice_config'->>'revision')::int,0)+CASE WHEN ((l.data->'practice_config')-'revision') IS DISTINCT FROM ((body->'practice_config')-'revision') THEN 1 ELSE 0 END));
 END IF;
 INSERT INTO public.course_lessons(id,course_id,section_id,sort_order,published,archived_at,data)
 VALUES(lesson_id_value,p_course,section_id_value,COALESCE((p_lesson->>'order')::integer,0),COALESCE((p_lesson->>'published')::boolean,false),(p_lesson->>'archived_at')::timestamptz,body)
 ON CONFLICT(course_id,id) DO UPDATE SET section_id=EXCLUDED.section_id,sort_order=EXCLUDED.sort_order,published=EXCLUDED.published,archived_at=EXCLUDED.archived_at,data=EXCLUDED.data RETURNING * INTO saved;
 IF p_questions IS NOT NULL THEN
   IF body->>'lesson_format'<>'quiz' OR jsonb_typeof(p_questions)<>'array' THEN RAISE EXCEPTION 'INVALID_QUESTIONS'; END IF;
   IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_questions) x)<>jsonb_array_length(p_questions) THEN RAISE EXCEPTION 'DUPLICATE_QUESTION_ID'; END IF;
   UPDATE public.course_section_questions SET archived_at=COALESCE(archived_at,now()) WHERE course_id=p_course AND lesson_id=lesson_id_value AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_questions) x WHERE x->>'id'=id);
   FOR q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
     IF NULLIF(q->>'id','') IS NULL OR EXISTS(SELECT 1 FROM public.course_section_questions WHERE id=q->>'id' AND (course_id<>p_course OR lesson_id IS DISTINCT FROM lesson_id_value)) THEN RAISE EXCEPTION 'QUESTION_SCOPE_MISMATCH'; END IF;
     INSERT INTO public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data,archived_at)
     VALUES(q->>'id',p_course,NULL,lesson_id_value,COALESCE((q->>'order')::int,0),q-ARRAY['id','order','course_id','lesson_id','section_id','archived_at'],NULL)
     ON CONFLICT(id) DO UPDATE SET sort_order=EXCLUDED.sort_order,data=EXCLUDED.data,archived_at=NULL;
   END LOOP;
 END IF;
 IF p_locales IS NOT NULL THEN
   FOR loc IN SELECT * FROM jsonb_each(p_locales) LOOP
     IF loc.key NOT IN ('vi','en') OR loc.value ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'INVALID_LESSON_LOCALE'; END IF;
     SELECT data INTO old_data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=lesson_id_value AND locale=loc.key;
     INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES(p_course,lesson_id_value,loc.key,COALESCE(old_data,'{}')||loc.value)
     ON CONFLICT(course_id,lesson_id,locale) DO UPDATE SET data=EXCLUDED.data;
   END LOOP;
 END IF;
 -- The root record is authoritative for its primary language; do not leave an
 -- old primary translation masking newly saved authoring content.
 INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data)
 SELECT p_course,lesson_id_value,COALESCE(data->'i18n'->>'primary_content_locale','vi'),jsonb_strip_nulls(jsonb_build_object(
   'title',body->'title','description_markdown',body->'description_markdown','short_description',body->'short_description',
   'youtube_url',body->'youtube_url','youtube_start_seconds',body->'youtube_start_seconds','youtube_end_seconds',body->'youtube_end_seconds','resources',body->'resources'))
 FROM public.courses WHERE id=p_course
 ON CONFLICT(course_id,lesson_id,locale) DO UPDATE SET data=EXCLUDED.data;
 RETURN to_jsonb(saved);
END $$;
CREATE FUNCTION public.learning_save_lesson(p_course text,p_lesson jsonb,p_questions jsonb DEFAULT NULL,p_locales jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_save_lesson(p_course,p_lesson,p_questions,p_locales); $$;
REVOKE ALL ON FUNCTION private.learning_save_lesson(text,jsonb,jsonb,jsonb),public.learning_save_lesson(text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_save_lesson(text,jsonb,jsonb,jsonb),public.learning_save_lesson(text,jsonb,jsonb,jsonb) TO authenticated;

CREATE FUNCTION private.learning_publish_report(p_course text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE issues jsonb:='[]'; l record; e text; c public.courses%ROWTYPE; BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.courses WHERE id=p_course;
 IF NOT FOUND THEN RAISE EXCEPTION 'COURSE_NOT_FOUND'; END IF;
 IF COALESCE(btrim(c.data->>'title'),'')='' OR COALESCE(btrim(c.slug),'')='' THEN issues:=issues||jsonb_build_array(jsonb_build_object('field','title','code','title_required')); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=p_course AND published AND archived_at IS NULL) THEN issues:=issues||jsonb_build_array(jsonb_build_object('field','curriculum','code','published_lesson_required')); END IF;
 IF NULLIF(btrim(c.data->>'final_assignment_title'),'') IS NOT NULL AND COALESCE(btrim(c.data->>'final_assignment_instructions'),'')='' THEN issues:=issues||jsonb_build_array(jsonb_build_object('field','final_assignment_instructions','code','final_instructions_required')); END IF;
 FOR l IN SELECT id,data,course_id FROM public.course_lessons WHERE course_id=p_course AND published AND archived_at IS NULL LOOP
   FOREACH e IN ARRAY private.learning_lesson_errors(l.id,l.data,l.course_id) LOOP issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',l.id,'field','content','code',e)); END LOOP;
 END LOOP;
 RETURN issues;
END $$;
CREATE FUNCTION public.learning_publish_report(p_course text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_publish_report(p_course); $$;
REVOKE ALL ON FUNCTION private.learning_publish_report(text),public.learning_publish_report(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_publish_report(text),public.learning_publish_report(text) TO authenticated;

CREATE FUNCTION private.learning_event(p_course text,p_lesson text,p_event text,p_passed boolean DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.learning_lesson_visible(p_course,p_lesson) THEN RAISE EXCEPTION 'LESSON_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 IF p_event NOT IN ('lesson_started','code_exercise_checked') THEN RAISE EXCEPTION 'INVALID_LEARNING_EVENT'; END IF;
 IF p_event='lesson_started' AND EXISTS(SELECT 1 FROM public.activity_events WHERE actor_id=auth.uid() AND verb='learning.lesson_started' AND object_id=p_lesson) THEN RETURN; END IF;
 INSERT INTO public.activity_events(actor_id,verb,object_type,object_id,target_type,target_id,payload,visibility) VALUES(auth.uid(),'learning.'||p_event,'lesson',p_lesson,'course',p_course,CASE WHEN p_event='code_exercise_checked' THEN jsonb_build_object('passed',p_passed) ELSE '{}' END,'private');
END $$;
CREATE FUNCTION public.learning_event(p_course text,p_lesson text,p_event text,p_passed boolean DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_event(p_course,p_lesson,p_event,p_passed); $$;
REVOKE ALL ON FUNCTION private.learning_event(text,text,text,boolean),public.learning_event(text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_event(text,text,text,boolean),public.learning_event(text,text,text,boolean) TO authenticated;
CREATE INDEX learning_events_lookup ON public.activity_events(actor_id,verb,object_id) WHERE verb LIKE 'learning.%';

CREATE FUNCTION private.learning_report(p_course text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'students') THEN RAISE EXCEPTION 'COURSE_STUDENTS_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'enrolled',(SELECT count(*) FROM public.enrollments WHERE course_id=p_course),
 'completed',(SELECT count(*) FROM public.enrollments WHERE course_id=p_course AND completed_at IS NOT NULL),
 'submitted',(SELECT count(DISTINCT user_id) FROM public.final_assignment_submissions WHERE course_id=p_course),
 'approved',(SELECT count(DISTINCT user_id) FROM public.final_assignment_submissions WHERE course_id=p_course AND status='approved'),
 'lessons',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'title',l.data->>'title',
   'started',(SELECT count(DISTINCT actor_id) FROM public.activity_events WHERE object_id=l.id AND verb='learning.lesson_started'),
   'completed',(SELECT count(*) FROM public.lesson_progress WHERE lesson_id=l.id AND completed_at IS NOT NULL),
   'quiz_attempts',(SELECT count(DISTINCT attempt_group_id) FROM public.section_question_attempts WHERE lesson_id=l.id),
   'quiz_passes',(SELECT count(DISTINCT attempt_group_id) FROM public.section_question_attempts WHERE lesson_id=l.id AND group_correct::numeric/NULLIF(group_total,0)>=passing_ratio)) ORDER BY l.sort_order) FROM public.course_lessons l WHERE l.course_id=p_course AND l.archived_at IS NULL),'[]'));
END $$;
CREATE FUNCTION public.learning_report(p_course text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_report(p_course); $$;
REVOKE ALL ON FUNCTION private.learning_report(text),public.learning_report(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_report(text),public.learning_report(text) TO authenticated;

CREATE FUNCTION private.learning_save_course(p_course text,p_data jsonb,p_slug text,p_published boolean,p_locales jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; loc record; BEGIN
 IF NOT private.can_manage_course(p_course,auth.uid()) THEN RAISE EXCEPTION 'COURSE_MANAGE_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 IF COALESCE(btrim(p_slug),'')='' OR COALESCE(btrim(p_data->>'title'),'')='' THEN RAISE EXCEPTION 'TITLE_REQUIRED'; END IF;
 IF p_data ? 'instructors' THEN
   IF jsonb_typeof(p_data->'instructors')<>'array' THEN RAISE EXCEPTION 'INVALID_INSTRUCTORS'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(p_data->'instructors') LOOP
     IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id::text=item->>'profile_id') OR (SELECT count(*) FROM jsonb_array_elements(p_data->'instructors') x WHERE x->>'profile_id'=item->>'profile_id')<>1 THEN RAISE EXCEPTION 'INVALID_INSTRUCTORS'; END IF;
   END LOOP;
 END IF;
 UPDATE public.courses SET data=data||(p_data-ARRAY['id','slug','published','archived_at','instructor_id','co_instructor_permissions','owner_type']),slug=p_slug,published=p_published,updated_at=clock_timestamp() WHERE id=p_course;
 IF NOT FOUND THEN RAISE EXCEPTION 'COURSE_NOT_FOUND'; END IF;
 FOR loc IN SELECT * FROM jsonb_each(p_locales) LOOP
   IF loc.key NOT IN ('vi','en') OR loc.value ?| ARRAY['instructors','has_certificate','final_assignment_fields','owner_type','co_instructor_permissions'] THEN RAISE EXCEPTION 'INVALID_COURSE_LOCALE'; END IF;
   INSERT INTO public.course_locales(course_id,locale,data) VALUES(p_course,loc.key,loc.value) ON CONFLICT(course_id,locale) DO UPDATE SET data=EXCLUDED.data;
 END LOOP;
 INSERT INTO public.course_locales(course_id,locale,data) VALUES(p_course,COALESCE(p_data->'i18n'->>'primary_content_locale','vi'),jsonb_strip_nulls(jsonb_build_object(
  'title',p_data->'title','description',p_data->'description','short_description',p_data->'short_description',
  'learning_outcomes',p_data->'learning_outcomes','final_assignment_title',p_data->'final_assignment_title',
  'final_assignment_description',p_data->'final_assignment_description','final_assignment_instructions',p_data->'final_assignment_instructions')))
 ON CONFLICT(course_id,locale) DO UPDATE SET data=EXCLUDED.data;
END $$;
CREATE FUNCTION public.learning_save_course(p_course text,p_data jsonb,p_slug text,p_published boolean,p_locales jsonb DEFAULT '{}') RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.learning_save_course(p_course,p_data,p_slug,p_published,p_locales); $$;
REVOKE ALL ON FUNCTION private.learning_save_course(text,jsonb,text,boolean,jsonb),public.learning_save_course(text,jsonb,text,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_save_course(text,jsonb,text,boolean,jsonb),public.learning_save_course(text,jsonb,text,boolean,jsonb) TO authenticated;
