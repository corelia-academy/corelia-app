BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('cccc1234-0000-4000-8000-000000000001','learning-audit-owner@corelia.local'),
 ('cccc1234-0000-4000-8000-000000000002','learning-audit-user@corelia.local');
UPDATE public.profiles SET role='instructor' WHERE id='cccc1234-0000-4000-8000-000000000001';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('learning-audit','cccc1234-0000-4000-8000-000000000001','learning-audit',false,'{"title":"Audit","final_assignment_title":"Final","final_assignment_fields":["github_url","notes"]}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-audit','audit-section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-audit','audit-lesson','audit-section',true,'{"title":"Read","lesson_format":"article","description_markdown":"Read"}');
UPDATE public.courses SET published=true WHERE id='learning-audit';
DO $$ DECLARE denied boolean; payload jsonb; value text; BEGIN
 FOREACH value IN ARRAY ARRAY['https:///','https://user:secret@example.com','https://example.com:99999','javascript:alert(1)','https://exa mple.com'] LOOP
  IF private.learning_safe_url(value) THEN RAISE EXCEPTION 'unsafe URL accepted: %',value; END IF;
 END LOOP;
 IF NOT private.learning_safe_url('https://github.com/example/cli') OR NOT private.learning_safe_url('http://127.0.0.1:54321/storage/v1/object/sign/app/file?token=example',false) THEN RAISE EXCEPTION 'valid URL rejected'; END IF;
 FOREACH value IN ARRAY ARRAY['https:///','https://user:secret@example.com','https://example.com:99999','https://example.com\\@evil.com'] LOOP
  IF NOT ('resource_url_invalid'=ANY(private.learning_resource_errors(jsonb_build_array(jsonb_build_object('title','Resource','url',value))))) THEN RAISE EXCEPTION 'unsafe resource accepted: %',value; END IF;
  denied:=false;
  BEGIN INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-audit','bad-resource','audit-section',false,jsonb_build_object('title','Draft','resources',jsonb_build_array(jsonb_build_object('title','Resource','url',value)))); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'unsafe draft resource accepted: %',value; END IF;
 END LOOP;
 FOREACH value IN ARRAY ARRAY['https://www.youtube.com/watch?v=M7lc1UVf-VE','https://www.youtube.com/watch?feature=shared&v=M7lc1UVf-VE&si=abc','https://youtu.be/M7lc1UVf-VE?si=abc','https://www.youtube.com/shorts/M7lc1UVf-VE','https://www.youtube.com/live/M7lc1UVf-VE','youtube.com/embed/M7lc1UVf-VE','http://music.youtube.com/watch?v=M7lc1UVf-VE'] LOOP
  IF private.learning_youtube_id(value) IS DISTINCT FROM 'M7lc1UVf-VE' THEN RAISE EXCEPTION 'supported video URL rejected: %',value; END IF;
 END LOOP;
 FOREACH value IN ARRAY ARRAY['https://www.youtube.com/watch?v=M7lc1UVf-VExtra','https://example.com/watch?v=M7lc1UVf-VE','https://user:password@youtube.com/watch?v=M7lc1UVf-VE'] LOOP
  IF private.learning_youtube_id(value) IS NOT NULL THEN RAISE EXCEPTION 'invalid video URL accepted: %',value; END IF;
 END LOOP;
 IF private.learning_question_valid('{"question":42,"options":[]}',false) OR private.learning_question_valid('{"question":"Q","options":[{"id":"a","text":42},{"id":"b","text":"B"}],"correct_index":0}',true) THEN RAISE EXCEPTION 'malformed canonical question accepted'; END IF;
 IF cardinality(private.learning_lesson_errors('probe','{"title":42,"description_markdown":true,"lesson_format":"article"}','learning-audit'))=0 THEN RAISE EXCEPTION 'malformed master accepted'; END IF;
 IF private.learning_locale_copy_valid('{"question_copy":{"q":{"question":42}}}') OR private.learning_locale_copy_valid('{"practice_copy":{"step":{"title":{}}}}') THEN RAISE EXCEPTION 'malformed nested copy accepted'; END IF;
 FOREACH payload IN ARRAY ARRAY[
  '{"mode":"checklist","checklist_items":[{"id":"a","label":42}]}'::jsonb,
  '{"mode":"guided_project","project_steps":[{"id":"a","title":"Step","verification":"self_check","order":"first"}]}'::jsonb,
  '{"mode":"submission","submission_fields":[{}]}'::jsonb
 ] LOOP
  IF private.learning_practice_shape_valid(payload) THEN RAISE EXCEPTION 'malformed practice accepted'; END IF;
 END LOOP;
 IF NOT ('invalid_checklist'=ANY(private.learning_lesson_errors('probe','{"title":"P","lesson_format":"practice","description_markdown":"P","practice_config":{"mode":"checklist","checklist_items":[{"id":"same","label":"a"},{"id":"same","label":"b"}]}}','learning-audit'))) THEN RAISE EXCEPTION 'duplicate checklist accepted'; END IF;
 denied:=false;
 BEGIN UPDATE public.course_lessons SET data=jsonb_set(data,'{title}','42') WHERE course_id='learning-audit'; EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'direct malformed write accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','cccc1234-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean; payload jsonb; saved jsonb; BEGIN
 FOREACH payload IN ARRAY ARRAY[
  '{"github_url":"https:///","notes":"text"}'::jsonb,
  '{"github_url":"https://github.com/example/cli","notes":{"bad":"note"}}'::jsonb,
  '{"github_url":"https://github.com/example/cli","notes":"text","unknown":"extra"}'::jsonb
 ] LOOP
  denied:=false;
  BEGIN PERFORM public.learning_final_submit('learning-audit','Probe','[]',payload,gen_random_uuid()); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'malformed submission accepted'; END IF;
 END LOOP;
 denied:=false;
 BEGIN PERFORM public.learning_final_submit('learning-audit','Probe','[{"bad":"file"}]','{"github_url":"https://github.com/example/cli","notes":"Read"}',gen_random_uuid()); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'malformed file accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.final_assignment_submissions WHERE course_id='learning-audit') THEN RAISE EXCEPTION 'invalid payload wrote partial submission'; END IF;
 saved:=public.learning_final_submit('learning-audit','Probe','[]','{"github_url":"https://github.com/example/cli","notes":"Read"}','cccc1234-0000-4000-8000-000000000003');
 IF saved IS DISTINCT FROM public.learning_final_submit('learning-audit','Probe','[]','{"github_url":"https://github.com/example/cli","notes":"Read"}','cccc1234-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'replay changed result'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
