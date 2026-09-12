-- Structured locations extend the report without changing publication enforcement.
CREATE FUNCTION private.learning_issue_location(code text, lesson_id text, locale text, format text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('lessonId',lesson_id,'locale',locale,'panel','content','code',code,'field',field,'fieldPath',jsonb_build_array(field))
 FROM (SELECT CASE
  WHEN code='title_required' THEN 'title'
  WHEN code='content_required' THEN 'description_markdown'
  WHEN code='youtube_required' THEN 'youtube_url'
  WHEN code='invalid_segment' THEN 'youtube_end_seconds'
  WHEN code='invalid_threshold' THEN 'quiz_config'
  WHEN code='invalid_questions' THEN 'questions'
  WHEN code IN ('invalid_resources','resource_title_required','resource_url_invalid') THEN 'resources'
  WHEN format='code_exercise' THEN 'code_exercise_config'
  WHEN format='practice' THEN 'practice_config'
  ELSE 'title' END AS field) location;
$$;
REVOKE ALL ON FUNCTION private.learning_issue_location(text,text,text,text) FROM PUBLIC;

CREATE FUNCTION private.learning_resource_issues(resources jsonb, lesson_id text, locale text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE issues jsonb:='[]'; item record; code text; field text; BEGIN
 IF resources IS NULL THEN RETURN issues; END IF;
 IF jsonb_typeof(resources) IS DISTINCT FROM 'array' THEN
  RETURN jsonb_build_array(private.learning_issue_location('invalid_resources',lesson_id,locale,NULL));
 END IF;
 FOR item IN SELECT value,ordinality FROM jsonb_array_elements(resources) WITH ORDINALITY LOOP
  FOREACH code IN ARRAY private.learning_resource_errors(jsonb_build_array(item.value)) LOOP
   field:=CASE code WHEN 'resource_title_required' THEN 'title' WHEN 'resource_url_invalid' THEN 'url' ELSE NULL END;
   issues:=issues||jsonb_build_array(jsonb_build_object('lessonId',lesson_id,'locale',locale,'panel','content','code',code,
    'field',CASE WHEN field IS NULL THEN 'resources' ELSE 'resource-'||(item.ordinality-1)::text||'-'||field END,
    'fieldPath',CASE WHEN field IS NULL THEN jsonb_build_array('resources') ELSE jsonb_build_array('resources',item.ordinality-1,field) END));
  END LOOP;
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_resource_issues(jsonb,text,text) FROM PUBLIC;

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
  format:=COALESCE(l.data->>'lesson_format',CASE WHEN NULLIF(l.data->>'youtube_url','') IS NOT NULL THEN 'video' ELSE 'article' END);
  FOREACH code IN ARRAY private.learning_lesson_errors(l.id,l.data,l.course_id) LOOP
   IF code NOT IN ('invalid_resources','resource_title_required','resource_url_invalid') THEN issues:=issues||jsonb_build_array(private.learning_issue_location(code,l.id,primary_locale,format)); END IF;
  END LOOP;
  issues:=issues||private.learning_resource_issues(l.data->'resources',l.id,primary_locale);
  FOR loc IN SELECT locale,data FROM public.course_lesson_locales WHERE course_id=p_course AND lesson_id=l.id ORDER BY locale LOOP
   issues:=issues||private.learning_resource_issues(loc.data->'resources',l.id,loc.locale);
  END LOOP;
 END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION private.learning_publish_report(text) FROM PUBLIC,anon;
