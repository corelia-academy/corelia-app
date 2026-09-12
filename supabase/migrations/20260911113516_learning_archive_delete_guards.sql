-- Preserve archived records and quiz history; lesson/section IDs are course scoped.
CREATE OR REPLACE FUNCTION private.guard_learning_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME='courses' THEN
   IF OLD.published OR OLD.archived_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.enrollments WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.final_assignment_submissions WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_COURSE_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_lessons' THEN
   IF OLD.published OR OLD.archived_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id=OLD.course_id AND lesson_id=OLD.id) OR EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.course_id AND lesson_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_LESSON_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_sections' THEN
   IF EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=OLD.course_id AND section_id=OLD.id) THEN RAISE EXCEPTION 'SECTION_NOT_EMPTY'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.course_id AND question_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_QUESTION_REQUIRED'; END IF;
 END IF;
 RETURN OLD;
END $$;
