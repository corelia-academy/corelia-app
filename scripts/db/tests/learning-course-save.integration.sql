BEGIN;
INSERT INTO auth.users(id,email)
SELECT ('cccc3333-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'course-save-'||n||'@corelia.local' FROM generate_series(1,7) n;
UPDATE public.profiles SET role=CASE right(id::text,1) WHEN '6' THEN 'support_staff' WHEN '7' THEN 'admin' WHEN '2' THEN 'student' ELSE 'instructor' END WHERE id::text LIKE 'cccc3333%';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('atomic-course-save','cccc3333-0000-4000-8000-000000000001','atomic-course-save',false,'{"title":"Original","instructors":[{"profile_id":"cccc3333-0000-4000-8000-000000000005"}],"co_instructor_permissions":{"cccc3333-0000-4000-8000-000000000003":{"content":true},"cccc3333-0000-4000-8000-000000000004":{"submissions":true}}}');
INSERT INTO public.course_locales(course_id,locale,data) VALUES('atomic-course-save','vi','{"title":"Original","short_description":"Keep"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('atomic-course-save','s','{"title":"Section"}');
INSERT INTO public.hackathons(id,status,document) VALUES('atomic-course-reference','published','{"title":"Reference"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('atomic-course-save','l','s',true,'{"title":"Practice","lesson_format":"practice","description_markdown":"Instructions","practice_config":{"mode":"instruction","related_hackathon_id":"atomic-course-reference"}}');
UPDATE public.courses SET published=true WHERE id='atomic-course-save';
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ DECLARE actor integer; denied boolean; BEGIN
 FOR actor IN 0..7 LOOP
  PERFORM set_config('request.jwt.claim.sub',CASE WHEN actor=0 THEN '' ELSE 'cccc3333-0000-4000-8000-'||lpad(actor::text,12,'0') END,true);
  EXECUTE CASE WHEN actor=0 THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;
  denied:=false;
  BEGIN
   PERFORM public.learning_save_course_info('atomic-course-save','{"title":"Saved"}','vi','{"title":"Saved"}');
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF denied IS DISTINCT FROM (actor NOT IN (1,6,7)) THEN RAISE EXCEPTION 'Unexpected course Save permission for actor %',actor; END IF;
  RESET ROLE;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','cccc3333-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN
  PERFORM public.learning_save_course_info('atomic-course-save','{"title":"Must rollback"}','vi','{"title":42}');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Malformed locale accepted'; END IF;
 IF (SELECT data->>'title' FROM public.courses WHERE id='atomic-course-save')<>'Saved'
 OR (SELECT data->>'title' FROM public.course_locales WHERE course_id='atomic-course-save' AND locale='vi')<>'Saved' THEN RAISE EXCEPTION 'Partial course Save'; END IF;
 PERFORM public.learning_save_course_info('atomic-course-save','{"short_description":""}','vi','{"short_description":""}');
 IF (SELECT data->>'short_description' FROM public.course_locales WHERE course_id='atomic-course-save' AND locale='vi')<>'' THEN RAISE EXCEPTION 'Optional field not cleared'; END IF;
END $$;
RESET ROLE;
-- Attribution edits share the course transaction without altering feature grants.
SET LOCAL ROLE authenticated;
DO $$ DECLARE original_permissions jsonb; BEGIN
 SELECT data->'co_instructor_permissions' INTO original_permissions FROM public.courses WHERE id='atomic-course-save';
 PERFORM public.learning_save_course_info('atomic-course-save',
  '{"instructors":[{"profile_id":"cccc3333-0000-4000-8000-000000000005","order":0,"role_label":"Guest"}]}',
  'vi','{"title":"Saved"}');
 IF (SELECT data->'co_instructor_permissions' FROM public.courses WHERE id='atomic-course-save') IS DISTINCT FROM original_permissions THEN
  RAISE EXCEPTION 'Attribution changed feature permissions';
 END IF;
 IF (SELECT data#>>'{instructors,0,role_label}' FROM public.courses WHERE id='atomic-course-save') <> 'Guest' THEN
  RAISE EXCEPTION 'Attribution Save not persisted';
 END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','cccc3333-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN
  PERFORM public.learning_save_course_info('atomic-course-save','{"title":"Attribution bypass"}','vi','{"title":"Attribution bypass"}');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Attribution granted authoring'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','cccc3333-0000-4000-8000-000000000001',true);
UPDATE public.hackathons SET status='draft' WHERE id='atomic-course-reference';
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN
  PERFORM public.learning_save_course_info('atomic-course-save','{"title":"Must rollback after write"}','vi','{"title":"Must rollback after write"}');
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Published invalid course Save accepted'; END IF;
 IF (SELECT data->>'title' FROM public.courses WHERE id='atomic-course-save')<>'Saved'
 OR (SELECT data->>'title' FROM public.course_locales WHERE course_id='atomic-course-save' AND locale='vi')<>'Saved' THEN RAISE EXCEPTION 'Failed publication left partial course Save'; END IF;
END $$;
RESET ROLE;
-- Reproduce pre-enforcement/externally-invalid publication, then retire atomically.
SET CONSTRAINTS ALL DEFERRED;
SET LOCAL ROLE authenticated;
SELECT public.learning_save_course_info('atomic-course-save','{"published":false}','vi','{"title":"Saved"}');
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN IF (SELECT published FROM public.courses WHERE id='atomic-course-save') THEN RAISE EXCEPTION 'Unable to unpublish invalid course'; END IF; END $$;
RESET ROLE;
ROLLBACK;
