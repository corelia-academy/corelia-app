-- Compute locations from the candidate state inside the authoring transaction.
CREATE FUNCTION private.learning_lesson_issues(p_course text, p_id text, p_data jsonb, primary_locale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE issues jsonb:='[]'; code text; loc record; format text; BEGIN
 format:=COALESCE(p_data->>'lesson_format',CASE WHEN NULLIF(p_data->>'youtube_url','') IS NOT NULL THEN 'video' ELSE 'article' END);
 FOREACH code IN ARRAY private.learning_lesson_errors(p_id,p_data,p_course) LOOP
  IF code NOT IN ('invalid_resources','resource_title_required','resource_url_invalid') THEN issues:=issues||jsonb_build_array(private.learning_issue_location(code,p_id,primary_locale,format)); END IF;
 END LOOP;
 issues:=issues||private.learning_resource_issues(p_data->'resources',p_id,primary_locale);
 FOR loc IN SELECT locale,data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=p_id ORDER BY locale LOOP
  IF loc.locale<>primary_locale OR loc.data->'resources' IS DISTINCT FROM p_data->'resources' THEN
   issues:=issues||private.learning_resource_issues(loc.data->'resources',p_id,loc.locale);
  END IF;
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_lesson_issues(text,text,jsonb,text) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION private.learning_save_lesson(p_course text,p_lesson jsonb,p_questions jsonb DEFAULT NULL,p_locales jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.course_lessons%ROWTYPE; saved public.course_lessons%ROWTYPE; q jsonb; loc record; lesson_id_value text:=p_lesson->>'id'; section_id_value text:=p_lesson->>'section_id'; body jsonb; old_config jsonb; new_config jsonb; machine_old jsonb; machine_new jsonb; old_data jsonb; issues jsonb; primary_locale text;
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
 IF saved.published AND saved.archived_at IS NULL THEN
  SELECT COALESCE(data->'i18n'->>'primary_content_locale','vi') INTO primary_locale FROM public.courses WHERE id=p_course;
  issues:=private.learning_lesson_issues(p_course,lesson_id_value,saved.data,primary_locale);
  IF jsonb_array_length(issues)>0 THEN
   RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %', (SELECT string_agg(value->>'code',',') FROM jsonb_array_elements(issues))
    USING DETAIL=jsonb_build_object('issues',issues)::text;
  END IF;
 END IF;
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION private.learning_save_lesson(text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_save_lesson(text,jsonb,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.learning_publish_report(p_course text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE issues jsonb:='[]'; l record; loc record; code text; c public.courses%ROWTYPE; primary_locale text; format text; BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.courses WHERE id=p_course;
 IF NOT FOUND THEN RAISE EXCEPTION 'COURSE_NOT_FOUND'; END IF;
 primary_locale:=COALESCE(c.data->'i18n'->>'primary_content_locale','vi');
 IF COALESCE(btrim(c.data->>'title'),'')='' THEN issues:=issues||jsonb_build_array(jsonb_build_object('panel','info','field','title','fieldPath',jsonb_build_array('title'),'locale',primary_locale,'code','title_required')); END IF;
 IF COALESCE(btrim(c.slug),'')='' THEN issues:=issues||jsonb_build_array(jsonb_build_object('panel','info','field','slug','fieldPath',jsonb_build_array('slug'),'code','slug_required')); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=p_course AND published AND archived_at IS NULL) THEN issues:=issues||jsonb_build_array(jsonb_build_object('panel','content','field','curriculum','fieldPath',jsonb_build_array('curriculum'),'code','published_lesson_required')); END IF;
 IF NULLIF(btrim(c.data->>'final_assignment_title'),'') IS NOT NULL AND COALESCE(btrim(c.data->>'final_assignment_instructions'),'')='' THEN issues:=issues||jsonb_build_array(jsonb_build_object('panel','assignments','field','final_assignment_instructions','fieldPath',jsonb_build_array('final_assignment_instructions'),'locale',primary_locale,'code','final_instructions_required')); END IF;
 FOR l IN SELECT id,data,course_id FROM public.course_lessons WHERE course_id=p_course AND published AND archived_at IS NULL ORDER BY sort_order,id LOOP
  issues:=issues||private.learning_lesson_issues(p_course,l.id,l.data,primary_locale);
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_publish_report(text) FROM PUBLIC,anon;
