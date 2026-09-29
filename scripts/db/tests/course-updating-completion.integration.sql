BEGIN;
INSERT INTO auth.users(id,email) VALUES
  ('eeed0000-0000-4000-8000-000000000001','course-updating@corelia.local');
UPDATE public.profiles SET profile_public=true WHERE id='eeed0000-0000-4000-8000-000000000001';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES
  ('course-updating-test','eeed0000-0000-4000-8000-000000000001','course-updating-test',true,
   '{"title":"Updating course","is_updating":true}');
INSERT INTO public.course_sections(course_id,id,data) VALUES
  ('course-updating-test','updating-section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES
  ('course-updating-test','updating-lesson','updating-section',true,
   '{"title":"Article","lesson_format":"article","description_markdown":"Read this"}');
INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES
  ('updating-progress','eeed0000-0000-4000-8000-000000000001','course-updating-test','updating-lesson',now());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lesson_progress WHERE id='updating-progress' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Lesson progress was lost';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE course_id='course-updating-test' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Updating course was completed automatically';
  END IF;
  BEGIN
    UPDATE public.enrollments SET completed_at=now() WHERE course_id='course-updating-test';
    RAISE EXCEPTION 'Direct completion write was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'COURSE_UPDATING' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.enrollments SET certificate_issued_at=now() WHERE course_id='course-updating-test';
    RAISE EXCEPTION 'New certificate was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'COURSE_UPDATING' THEN RAISE; END IF;
  END;
END $$;

UPDATE public.courses SET data=jsonb_set(data,'{is_updating}','false') WHERE id='course-updating-test';
SELECT private.learning_sync_completion('course-updating-test','eeed0000-0000-4000-8000-000000000001');
DO $$ DECLARE milestone_id bigint; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE course_id='course-updating-test' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Ready course did not complete';
  END IF;
  SELECT id INTO milestone_id FROM public.feed_milestones WHERE course_id='course-updating-test' AND kind='course_completed';
  IF milestone_id IS NULL OR NOT private.feed_milestone_visible(milestone_id,NULL) THEN
    RAISE EXCEPTION 'Ready course milestone is missing';
  END IF;
END $$;

UPDATE public.enrollments SET certificate_issued_at=now() WHERE course_id='course-updating-test';
UPDATE public.courses SET data=jsonb_set(data,'{is_updating}','true') WHERE id='course-updating-test';
DO $$ DECLARE milestone_id bigint; BEGIN
  SELECT id INTO milestone_id FROM public.feed_milestones WHERE course_id='course-updating-test' AND kind='course_completed';
  IF private.feed_milestone_visible(milestone_id,NULL) THEN
    RAISE EXCEPTION 'Old milestone remained visible while updating';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE course_id='course-updating-test' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Historical completion was erased';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE course_id='course-updating-test' AND certificate_issued_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Previously issued certificate was erased';
  END IF;
END $$;
UPDATE public.courses SET data=jsonb_set(data,'{is_updating}','false') WHERE id='course-updating-test';
DO $$ DECLARE milestone_id bigint; BEGIN
  SELECT id INTO milestone_id FROM public.feed_milestones WHERE course_id='course-updating-test' AND kind='course_completed';
  IF NOT private.feed_milestone_visible(milestone_id,NULL) THEN
    RAISE EXCEPTION 'Historical milestone did not return';
  END IF;
END $$;
ROLLBACK;
