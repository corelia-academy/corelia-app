-- Course cascades remove the parent before its sections. The course and lesson
-- guards still protect published/archived records and all learner history.
CREATE OR REPLACE FUNCTION private.guard_learning_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME='courses' THEN
   IF OLD.published OR OLD.archived_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.enrollments WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.final_assignment_submissions WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_COURSE_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_lessons' THEN
   IF OLD.published OR OLD.archived_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id=OLD.course_id AND lesson_id=OLD.id) OR EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.course_id AND lesson_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_LESSON_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_sections' THEN
   IF EXISTS(SELECT 1 FROM public.courses WHERE id=OLD.course_id) AND EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=OLD.course_id AND section_id=OLD.id) THEN RAISE EXCEPTION 'SECTION_NOT_EMPTY'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id=OLD.course_id AND question_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_QUESTION_REQUIRED'; END IF;
 END IF;
 RETURN OLD;
END $$;

-- RLS remains active; this RPC adds atomicity, not extra privileges.
CREATE FUNCTION public.learning_delete_section(p_course text, p_section text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NOT private.can_manage_course_feature(p_course, auth.uid(), 'content') THEN
   RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE = '42501';
 END IF;
 -- Lock the section so concurrent lesson inserts cannot slip into the deletion.
 PERFORM 1 FROM public.course_sections WHERE course_id=p_course AND id=p_section FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SECTION_NOT_FOUND'; END IF;
 DELETE FROM public.course_lessons WHERE course_id=p_course AND section_id=p_section;
 DELETE FROM public.course_sections WHERE course_id=p_course AND id=p_section;
 IF NOT FOUND THEN RAISE EXCEPTION 'SECTION_DELETE_FAILED'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.learning_delete_section(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learning_delete_section(text,text) TO authenticated;
