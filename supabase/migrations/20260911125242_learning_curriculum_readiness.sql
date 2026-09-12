-- Readiness includes drafts and reuses the same validator as publication enforcement.
CREATE FUNCTION private.learning_curriculum_readiness(p_course text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN
   RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'lessonId',l.id,'issues',to_jsonb(private.learning_lesson_errors(l.id,l.data,l.course_id)))
   ORDER BY s.sort_order,l.sort_order,l.id)
 FROM public.course_lessons l LEFT JOIN public.course_sections s ON s.course_id=l.course_id AND s.id=l.section_id
 WHERE l.course_id=p_course AND l.archived_at IS NULL),'[]'::jsonb);
END $$;
CREATE FUNCTION public.learning_curriculum_readiness(p_course text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.learning_curriculum_readiness(p_course); $$;
REVOKE ALL ON FUNCTION private.learning_curriculum_readiness(text),public.learning_curriculum_readiness(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_curriculum_readiness(text),public.learning_curriculum_readiness(text) TO authenticated;
