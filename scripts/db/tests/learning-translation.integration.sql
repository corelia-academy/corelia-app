BEGIN;
DO $$ BEGIN
 IF NOT (private.learning_locale_video_issues('legacy','en','{"title":"Updating"}','{"youtube_url":"bad-url"}') @> '[{"locale":"en","code":"youtube_required"}]'::jsonb) THEN RAISE EXCEPTION 'Legacy video translation bypassed validation'; END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES('cccc5555-0000-4000-8000-000000000001','translation-author@corelia.local');
UPDATE public.profiles SET role='instructor' WHERE id='cccc5555-0000-4000-8000-000000000001';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('translation-course','cccc5555-0000-4000-8000-000000000001','translation-course',false,'{"title":"Khóa gốc","i18n":{"primary_content_locale":"vi"}}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('translation-course','s','{"title":"Chương"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES
 ('translation-course','video','s',true,'{"title":"Bài gốc","lesson_format":"video","youtube_url":"https://youtu.be/dQw4w9WgXcQ","youtube_start_seconds":40,"youtube_end_seconds":50,"duration_seconds":10}');
UPDATE public.courses SET published=true WHERE id='translation-course';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT set_config('request.jwt.claim.sub','cccc5555-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE original jsonb; candidate jsonb; failed boolean:=false; detail text; BEGIN
 SELECT data INTO original FROM public.course_lessons WHERE course_id='translation-course' AND id='video';
 candidate:=original||'{"id":"video","section_id":"s","order":0,"published":true}'::jsonb;
 -- Partial translation copy does not need a duplicated source title or video.
 PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"description_markdown":"English description"}}');
 IF (SELECT data FROM public.course_lessons WHERE course_id='translation-course' AND id='video') IS DISTINCT FROM original THEN RAISE EXCEPTION 'EN save changed master'; END IF;
 IF (SELECT data ? 'youtube_url' OR data ? 'title' FROM public.course_lesson_locales WHERE course_id='translation-course' AND lesson_id='video' AND locale='en') THEN RAISE EXCEPTION 'Source content was materialized in EN'; END IF;
 PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"title":"","youtube_url":"","youtube_start_seconds":0,"youtube_end_seconds":null}}');
 IF (SELECT data->>'description_markdown' FROM public.course_lesson_locales WHERE course_id='translation-course' AND lesson_id='video' AND locale='en')<>'English description' THEN RAISE EXCEPTION 'Partial update lost translation'; END IF;
 -- An explicit EN video uses its own segment, rather than master start=40.
 PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"youtube_url":"https://youtu.be/dQw4w9WgXcQ","youtube_start_seconds":0,"youtube_end_seconds":10}}');
 BEGIN
  PERFORM public.learning_save_lesson('translation-course',candidate||'{"title":"Must rollback"}',NULL,'{"en":{"youtube_url":"bad-url"}}');
 EXCEPTION WHEN raise_exception THEN
  failed:=true; GET STACKED DIAGNOSTICS detail=PG_EXCEPTION_DETAIL;
  IF NOT (detail::jsonb->'issues' @> '[{"lessonId":"video","locale":"en","field":"youtube_url","code":"youtube_required"}]'::jsonb) THEN RAISE EXCEPTION 'Missing EN URL location: %',detail; END IF;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Invalid EN video accepted'; END IF;
 IF (SELECT data FROM public.course_lessons WHERE course_id='translation-course' AND id='video') IS DISTINCT FROM original THEN RAISE EXCEPTION 'Failed translation left partial master write'; END IF;
 IF (SELECT data->>'youtube_url' FROM public.course_lesson_locales WHERE course_id='translation-course' AND lesson_id='video' AND locale='en')<>'https://youtu.be/dQw4w9WgXcQ' THEN RAISE EXCEPTION 'Failed translation left partial locale write'; END IF;
 failed:=false;
 BEGIN
  PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"youtube_start_seconds":20,"youtube_end_seconds":10}}');
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Invalid EN segment accepted'; END IF;
 -- Blank override returns to the master video, stale local segments no longer apply.
 PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"youtube_url":"","youtube_start_seconds":0,"youtube_end_seconds":null}}');
 PERFORM public.learning_save_course_info('translation-course','{}','en','{}');
 IF EXISTS(SELECT 1 FROM public.course_locales WHERE course_id='translation-course' AND locale='en') THEN RAISE EXCEPTION 'Untouched course translation created'; END IF;
END $$;
RESET ROLE;
-- Simulate a formerly valid published reference becoming unavailable externally.
INSERT INTO public.hackathons(id,status,document) VALUES('translation-reference','published','{"title":"Reference"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('translation-course','practice','s',true,'{"title":"Practice","lesson_format":"practice","description_markdown":"Instructions","practice_config":{"mode":"instruction","related_hackathon_id":"translation-reference"}}');
UPDATE public.hackathons SET status='draft' WHERE id='translation-reference';
SET LOCAL ROLE authenticated;
DO $$ DECLARE candidate jsonb; failed boolean:=false; BEGIN
 SELECT data||'{"id":"video","section_id":"s","order":0,"published":true,"duration_seconds":15}'::jsonb INTO candidate FROM public.course_lessons WHERE course_id='translation-course' AND id='video';
 PERFORM public.learning_save_lesson('translation-course',candidate,NULL,'{"en":{"title":"English"}}');
 PERFORM public.refresh_course_total_duration('translation-course');
 IF (SELECT (data->>'total_duration_seconds')::int FROM public.courses WHERE id='translation-course')<>15 THEN RAISE EXCEPTION 'Duration not synchronized'; END IF;
 BEGIN
  PERFORM public.learning_save_course_info('translation-course','{"title":"Must rollback"}','vi','{}');
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Publication guard bypassed for content change'; END IF;
 IF (SELECT data->>'title' FROM public.courses WHERE id='translation-course')<>'Khóa gốc' THEN RAISE EXCEPTION 'Invalid course edit committed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
