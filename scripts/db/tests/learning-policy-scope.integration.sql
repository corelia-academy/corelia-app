-- AUD-10 regression: real operations under each role, with every probe rolled back.
BEGIN;
INSERT INTO auth.users(id,email,instance_id,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change)
SELECT ('cccc2222-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'policy-'||n||'@corelia.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),'','','','' FROM generate_series(1,7) n;
UPDATE public.profiles SET role=CASE right(id::text,1) WHEN '6' THEN 'support_staff' WHEN '7' THEN 'admin' WHEN '2' THEN 'student' ELSE 'instructor' END WHERE id::text LIKE 'cccc2222%';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('policy-scope','cccc2222-0000-4000-8000-000000000001','policy-scope',false,'{"title":"Policy scope","instructors":[{"profile_id":"cccc2222-0000-4000-8000-000000000005"}],"co_instructor_permissions":{"cccc2222-0000-4000-8000-000000000003":{"content":true},"cccc2222-0000-4000-8000-000000000004":{"submissions":true}}}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('policy-scope','section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('policy-scope','lesson','section',true,'{"title":"Lesson","lesson_format":"article","description_markdown":"Body"}');
INSERT INTO public.course_locales(course_id,locale,data) VALUES('policy-scope','en','{"title":"Course English"}');
INSERT INTO public.course_section_locales(course_id,section_id,locale,data) VALUES('policy-scope','section','en','{"title":"Section English"}');
INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('policy-scope','lesson','en','{"title":"Lesson English"}');
UPDATE public.courses SET published=true WHERE id='policy-scope';
DO $$ DECLARE actor integer; relation_name text; affected integer; expected integer; BEGIN
 FOR actor IN 0..7 LOOP
  PERFORM set_config('request.jwt.claim.sub',CASE WHEN actor=0 THEN '' ELSE 'cccc2222-0000-4000-8000-'||lpad(actor::text,12,'0') END,true);
  EXECUTE CASE WHEN actor=0 THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;
  expected:=CASE WHEN actor IN (1,3,6,7) THEN 1 ELSE 0 END;
  FOREACH relation_name IN ARRAY ARRAY['course_locales','course_section_locales','course_lesson_locales'] LOOP
   affected:=-1;
   BEGIN
    EXECUTE format('DELETE FROM public.%I WHERE course_id=''policy-scope''',relation_name);
    GET DIAGNOSTICS affected=ROW_COUNT;
    RAISE EXCEPTION SQLSTATE 'P0002' USING MESSAGE='rollback probe';
   EXCEPTION WHEN no_data_found THEN NULL; END;
   IF affected<>expected THEN RAISE EXCEPTION 'Actor % DELETE % affected %, expected %',actor,relation_name,affected,expected; END IF;
  END LOOP;
  FOREACH relation_name IN ARRAY ARRAY['course_locales','course_section_locales','course_lesson_locales','course_sections','course_lessons'] LOOP
   EXECUTE format('UPDATE public.%I SET data=data WHERE course_id=''policy-scope''',relation_name);
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected<>expected THEN RAISE EXCEPTION 'Actor % UPDATE % affected %, expected %',actor,relation_name,affected,expected; END IF;
  END LOOP;
  RESET ROLE;
 END LOOP;
END $$;
ROLLBACK;
