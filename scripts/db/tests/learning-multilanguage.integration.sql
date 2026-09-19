BEGIN;
-- The same text rules apply to each supported language; no code is executed.
DO $$
DECLARE lang text; ext text; mode text; config jsonb; errors text[];
BEGIN
 FOR lang,ext IN SELECT * FROM (VALUES ('rust','rs'),('typescript','ts'),('javascript','js'),('python','py'),('java','java'),('c','c'),('cpp','cpp'),('go','go')) x(lang,ext) LOOP
  FOREACH mode IN ARRAY ARRAY['fill','edit'] LOOP
   config:=jsonb_build_object('schema_version',1,'revision',1,'language',lang,'mode',mode,
     'file',jsonb_build_object('path','main.'||ext,'starter_source',CASE WHEN mode='fill' THEN '{{blank:answer}}' ELSE '0' END),
     'reference_solution','42');
   IF mode='fill' THEN config:=config||'{"blanks":[{"id":"answer","accepted_answers":["42"]}]}'::jsonb;
   ELSE config:=config||'{"tests":[{"id":"answer","type":"source_equals","required":true,"description":"Answer","accepted_sources":["42"]}]}'::jsonb; END IF;
   errors:=private.learning_code_errors(config,true);
   IF cardinality(errors)>0 THEN RAISE EXCEPTION 'Valid %/% rejected: %',lang,mode,errors; END IF;
   IF NOT ('invalid_file'=ANY(private.learning_code_errors(jsonb_set(config,'{file,path}','"../bad.txt"'),true))) THEN RAISE EXCEPTION 'Unsafe file accepted'; END IF;
   IF NOT ('source_required'=ANY(private.learning_code_errors(jsonb_set(config,'{reference_solution}','""'),true))) THEN RAISE EXCEPTION 'Missing solution accepted'; END IF;
   IF NOT ('solution_failed'=ANY(private.learning_code_errors(jsonb_set(config,'{reference_solution}','"wrong"'),true))) THEN RAISE EXCEPTION 'Wrong solution accepted'; END IF;
   IF cardinality(private.learning_code_errors(jsonb_set(config,'{reference_solution}','"wrong"'),false))>0 THEN RAISE EXCEPTION 'Unfinished solution rejected for draft'; END IF;
   IF mode='edit' AND NOT ('required_test_missing'=ANY(private.learning_code_errors(jsonb_set(config,'{tests}','[]'),false))) THEN RAISE EXCEPTION 'Missing required test accepted'; END IF;
   IF lang='cpp' THEN
    IF cardinality(private.learning_code_errors(jsonb_set(config,'{file,path}','"main.cc"')))>0 OR cardinality(private.learning_code_errors(jsonb_set(config,'{file,path}','"main.cxx"')))>0 THEN RAISE EXCEPTION 'C++ alternative extension rejected'; END IF;
   END IF;
  END LOOP;
 END LOOP;
 IF NOT ('unsupported_config'=ANY(private.learning_code_errors(jsonb_set(config,'{language}','"unknown"')))) THEN RAISE EXCEPTION 'Unknown language accepted'; END IF;
END $$;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('cccc6666-0000-4000-8000-000000000001','multilanguage-instructor@corelia.local','{"full_name":"Code Instructor"}');
UPDATE public.profiles SET role='instructor' WHERE id='cccc6666-0000-4000-8000-000000000001';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('multilanguage-course','cccc6666-0000-4000-8000-000000000001','multilanguage-course',false,'{"title":"Code course","i18n":{"primary_content_locale":"vi"}}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('multilanguage-course','s','{"title":"Section"}');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT set_config('request.jwt.claim.sub','cccc6666-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE lang text; ext text; mode text; config jsonb; candidate jsonb; saved jsonb; row_data jsonb; target_lesson_id text;
BEGIN
 FOR lang,ext IN SELECT * FROM (VALUES ('rust','rs'),('typescript','ts'),('javascript','js'),('python','py'),('java','java'),('c','c'),('cpp','cpp'),('go','go')) x(lang,ext) LOOP
  FOREACH mode IN ARRAY ARRAY['fill','edit'] LOOP
   target_lesson_id:=lang||'-'||mode;
   config:=jsonb_build_object('schema_version',1,'revision',1,'language',lang,'mode',mode,
     'file',jsonb_build_object('path','main.'||ext,'starter_source',CASE WHEN mode='fill' THEN '{{blank:answer}}' ELSE '0' END),'reference_solution','42','hints',jsonb_build_array('Keep hint'));
   IF mode='fill' THEN config:=config||'{"blanks":[{"id":"answer","accepted_answers":["42"],"feedback":"Try again"}]}'::jsonb;
   ELSE config:=config||'{"tests":[{"id":"answer","type":"contains","required":true,"description":"Answer","value":"42"}]}'::jsonb; END IF;
   candidate:=jsonb_build_object('id',target_lesson_id,'section_id','s','published',false,'title','Code','lesson_format','code_exercise','description_markdown','Instructions','code_exercise_config',config);
   saved:=public.learning_save_lesson('multilanguage-course',candidate,NULL,'{}');
   IF saved->'data'->'code_exercise_config' IS DISTINCT FROM config THEN RAISE EXCEPTION 'Draft lost code configuration: %',target_lesson_id; END IF;
   candidate:=candidate||'{"published":true}'::jsonb;
   PERFORM public.learning_save_lesson('multilanguage-course',candidate,NULL,'{"en":{"title":"English code","description_markdown":"English instructions"}}');
   SELECT data INTO row_data FROM public.course_lessons WHERE course_id='multilanguage-course' AND id=target_lesson_id AND published;
   IF row_data->'code_exercise_config' IS DISTINCT FROM config OR row_data->>'description_markdown' IS DISTINCT FROM 'Instructions' THEN RAISE EXCEPTION 'Published readback mismatch: %',target_lesson_id; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.course_lesson_locales l WHERE l.course_id='multilanguage-course' AND l.lesson_id=target_lesson_id AND l.locale='en' AND l.data->>'title'='English code') THEN RAISE EXCEPTION 'Translation lost: %',target_lesson_id; END IF;
  END LOOP;
 END LOOP;
 -- The original staging practice failure must not need any video or translation.
 candidate:='{"id":"practice","section_id":"s","published":false,"title":"Practice","lesson_format":"practice","description_markdown":"Build a task filter","practice_config":{"mode":"instruction"}}';
 PERFORM public.learning_save_lesson('multilanguage-course',candidate,NULL,'{}');
 PERFORM public.learning_save_lesson('multilanguage-course',candidate||'{"published":true}',NULL,'{}');
 IF NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id='multilanguage-course' AND id='practice' AND published AND data->>'description_markdown'='Build a task filter') THEN RAISE EXCEPTION 'Practice publish/readback failed'; END IF;
 -- Changing language invalidates old learner code drafts through canonical revision.
 SELECT data||'{"id":"rust-fill","section_id":"s","published":true}'::jsonb INTO candidate FROM public.course_lessons WHERE course_id='multilanguage-course' AND id='rust-fill';
 candidate:=jsonb_set(jsonb_set(candidate,'{code_exercise_config,language}','"python"'),'{code_exercise_config,file,path}','"main.py"');
 saved:=public.learning_save_lesson('multilanguage-course',candidate,NULL,'{}');
 IF saved#>>'{data,code_exercise_config,revision}' IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'Language change did not advance revision'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
