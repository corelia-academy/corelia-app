-- Only the disposable pre-Learning database. Fails closed if Learning is applied.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='published') THEN RAISE EXCEPTION 'PRE_LEARNING_SCHEMA_REQUIRED'; END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('dddd0000-0000-4000-8000-000000000001','legacy-owner@corelia.local'),
 ('dddd0000-0000-4000-8000-000000000002','legacy-co@corelia.local'),
 ('dddd0000-0000-4000-8000-000000000003','legacy-learner@corelia.local'),
 ('dddd0000-0000-4000-8000-000000000004','legacy-support@corelia.local');
UPDATE public.profiles SET role='instructor' WHERE id IN ('dddd0000-0000-4000-8000-000000000001','dddd0000-0000-4000-8000-000000000002');
UPDATE public.profiles SET role='support_staff' WHERE id='dddd0000-0000-4000-8000-000000000004';
INSERT INTO public.courses(id,slug,instructor_id,published,data) VALUES('learning-upgrade-fixture','learning-upgrade-fixture','dddd0000-0000-4000-8000-000000000001',true,'{"title":"Legacy fixture","co_instructors":[{"id":"dddd0000-0000-4000-8000-000000000002"},{"id":"dddd0000-0000-4000-8000-000000000002"},{"id":"missing-profile"}],"co_instructor_permissions":{"dddd0000-0000-4000-8000-000000000002":{"content":true,"submissions":false,"students":false}},"final_assignment_title":"Final","final_assignment_instructions":"Submit notes"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-upgrade-fixture','legacy-section','{"title":"Legacy"}');
INSERT INTO public.course_lessons(course_id,id,section_id,sort_order,data) VALUES
 ('learning-upgrade-fixture','legacy-article','legacy-section',0,'{"title":"No explicit format","description_markdown":"Keep article","duration_seconds":37}'),
 ('learning-upgrade-fixture','legacy-empty','legacy-section',1,'{"title":"Unavailable draft","duration_seconds":12}'),
 ('learning-upgrade-fixture','legacy-quiz','legacy-section',2,'{"title":"Quiz","lesson_format":"quiz"}'),
 ('learning-upgrade-fixture','legacy-video','legacy-section',3,'{"title":"Legacy video","youtube_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","duration_seconds":90}');
INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('learning-upgrade-fixture','legacy-video','en','{"title":"English video","subtitle_locales":{"bad":true},"has_subtitle":"yes"}');
INSERT INTO public.course_section_questions(id,course_id,lesson_id,section_id,sort_order,data) VALUES('legacy-question','learning-upgrade-fixture','legacy-quiz',NULL,0,'{"type":"mcq","question":"Choose A","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}');
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at,completed_at,certificate_issued_at) VALUES('legacy-enrollment','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','2026-01-01Z','2026-01-02Z','2026-01-03Z','2026-01-04Z');
INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES('legacy-progress','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','legacy-article','2026-01-02Z');
INSERT INTO public.section_question_attempts(id,user_id,course_id,lesson_id,section_id,question_id,selected_index,is_correct,attempted_at) VALUES('legacy-attempt','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','legacy-quiz',NULL,'legacy-question',1,false,'2026-01-02Z');
INSERT INTO public.final_assignment_submissions(id,user_id,course_id,content,submitted_at,status,reviewed_at,reviewer_comment) VALUES
 ('legacy-rejected','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','Keep first submission','2026-01-02Z','rejected','2026-01-03Z','Add tests'),
 ('legacy-resubmitted','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','Keep second submission','2026-01-04Z','pending',NULL,NULL);
-- Malformed canonical quiz data predates the new shape guard. Keep it for recovery QA.
INSERT INTO public.course_lessons(course_id,id,section_id,sort_order,data) VALUES
 ('learning-upgrade-fixture','legacy-malformed-quiz','legacy-section',4,'{"title":"Malformed legacy quiz","lesson_format":"quiz"}');
INSERT INTO public.course_section_questions(id,course_id,lesson_id,sort_order,data) VALUES
 ('legacy-malformed-question','learning-upgrade-fixture','legacy-malformed-quiz',0,'{"type":"mcq","question":"Question","options":[{"id":"a","text":42},{"id":"b","text":"B"}],"correct_index":0}');
COMMIT;
