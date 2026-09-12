-- AUD-10: splitting an ALL policy must not reuse public read visibility for DELETE.
-- Keep the existing content feature/owner/staff rules, independently for each operation.
DO $$
DECLARE relation_name text;
BEGIN
 FOREACH relation_name IN ARRAY ARRAY['course_locales','course_sections','course_section_locales','course_lessons','course_lesson_locales'] LOOP
  EXECUTE format('ALTER POLICY %I ON public.%I USING (private.can_manage_course_feature(course_id,(SELECT auth.uid()),''content''))',relation_name||'_all_learning_delete',relation_name);
  EXECUTE format('ALTER POLICY %I ON public.%I USING (private.can_manage_course_feature(course_id,(SELECT auth.uid()),''content'')) WITH CHECK (private.can_manage_course_feature(course_id,(SELECT auth.uid()),''content''))',relation_name||'_all_learning_update',relation_name);
 END LOOP;
END $$;
