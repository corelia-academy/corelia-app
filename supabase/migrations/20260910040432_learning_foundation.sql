-- Additive publication and attribution model. Historical completion is untouched.
ALTER TABLE public.courses ADD COLUMN archived_at timestamptz;
ALTER TABLE public.course_lessons ADD COLUMN published boolean NOT NULL DEFAULT false;
ALTER TABLE public.course_lessons ADD COLUMN archived_at timestamptz;
ALTER TABLE public.course_section_questions ADD COLUMN archived_at timestamptz;
ALTER TABLE public.section_question_attempts ADD COLUMN attempt_group_id uuid;
ALTER TABLE public.final_assignment_submissions ADD COLUMN artifacts jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX learning_attempt_request_question ON public.section_question_attempts(user_id, attempt_group_id, question_id) WHERE attempt_group_id IS NOT NULL;
CREATE INDEX learning_visible_lessons ON public.course_lessons(course_id, section_id, sort_order) WHERE published AND archived_at IS NULL;
CREATE INDEX learning_latest_submission ON public.final_assignment_submissions(user_id, course_id, submitted_at DESC, id DESC);

CREATE OR REPLACE FUNCTION private.learning_course_visible(p_course text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.courses WHERE id=p_course AND published AND archived_at IS NULL);
$$;
CREATE OR REPLACE FUNCTION private.learning_lesson_visible(p_course text, p_lesson text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT private.learning_course_visible(p_course) AND EXISTS(SELECT 1 FROM public.course_lessons WHERE id=p_lesson AND course_id=p_course AND published AND archived_at IS NULL);
$$;
REVOKE ALL ON FUNCTION private.learning_course_visible(text), private.learning_lesson_visible(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.learning_course_visible(text), private.learning_lesson_visible(text,text) TO anon, authenticated, service_role;

UPDATE public.course_lessons SET published = CASE
 WHEN data->>'lesson_format' = 'quiz' THEN true
 WHEN data->>'lesson_format' IN ('article','practice') THEN COALESCE(NULLIF(btrim(data->>'description_markdown'),''),NULLIF(btrim(data->>'short_description'),'')) IS NOT NULL
 WHEN data->>'lesson_format' = 'video' THEN NULLIF(btrim(data->>'youtube_url'),'') IS NOT NULL
 ELSE COALESCE(NULLIF(btrim(data->>'youtube_url'),''),NULLIF(btrim(data->>'description_markdown'),''),NULLIF(btrim(data->>'short_description'),'')) IS NOT NULL END;
UPDATE public.courses c SET data = jsonb_set(c.data, '{instructors}', COALESCE((
 SELECT jsonb_agg(jsonb_build_object('profile_id', p.id::text,'order', refs.ord - 1) ORDER BY refs.ord)
 FROM (SELECT DISTINCT ON (id) id, ord FROM (
   SELECT c.instructor_id::text AS id, 1::bigint AS ord
   UNION ALL SELECT item->>'id', ordinality+1 FROM jsonb_array_elements(COALESCE(c.data->'co_instructors','[]')) WITH ORDINALITY x(item,ordinality)
 ) candidates ORDER BY id,ord) refs JOIN public.profiles p ON p.id::text=refs.id
),'[]'::jsonb)) WHERE NOT c.data ? 'instructors';

-- Preserve existing instructor/co-instructor mutation permissions while separating
-- publication-aware reads from legacy FOR ALL policies.
DO $$ DECLARE t text; p record; visible text; manager text; BEGIN
 FOREACH t IN ARRAY ARRAY['courses','course_sections','course_lessons','course_locales','course_section_locales','course_lesson_locales','course_section_questions'] LOOP
   FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd IN ('ALL','SELECT') LOOP
     IF p.cmd='ALL' THEN
       EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR INSERT TO %s WITH CHECK (%s)',p.policyname||'_learning_insert',t,p.permissive,array_to_string(p.roles,','),COALESCE(p.with_check,p.qual,'true'));
       EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',p.policyname||'_learning_update',t,p.permissive,array_to_string(p.roles,','),COALESCE(p.qual,'true'),COALESCE(p.with_check,p.qual,'true'));
       EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR DELETE TO %s USING (%s)',p.policyname||'_learning_delete',t,p.permissive,array_to_string(p.roles,','),COALESCE(p.qual,'true'));
     END IF;
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   visible := CASE WHEN t='courses' THEN '(published AND archived_at IS NULL)'
     WHEN t='course_lessons' THEN '(published AND archived_at IS NULL AND private.learning_course_visible(course_id))'
     WHEN t='course_lesson_locales' THEN 'private.learning_lesson_visible(course_id,lesson_id)'
     WHEN t='course_section_questions' THEN '(archived_at IS NULL AND CASE WHEN lesson_id IS NOT NULL THEN private.learning_lesson_visible(course_id,lesson_id) ELSE private.learning_course_visible(course_id) END)'
     ELSE 'private.learning_course_visible(course_id)' END;
   manager:=CASE WHEN t='courses' THEN 'private.can_manage_course_feature(id,(SELECT auth.uid()),''content'')' ELSE 'private.can_manage_course_feature(course_id,(SELECT auth.uid()),''content'')' END;
   EXECUTE format('CREATE POLICY learning_read ON public.%I FOR SELECT TO anon,authenticated USING (%s OR %s)', t, manager, visible);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['enrollments','lesson_progress','final_assignment_submissions','section_question_attempts'] LOOP
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY learning_private_read ON public.%I FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR private.can_manage_course_feature(course_id,(SELECT auth.uid()),%L))',t,CASE WHEN t='final_assignment_submissions' THEN 'submissions' ELSE 'students' END);
 END LOOP;
END $$;
CREATE POLICY learning_enroll ON public.enrollments FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND private.learning_course_visible(course_id) AND completed_at IS NULL);
CREATE POLICY learning_enroll_update ON public.enrollments FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY learning_progress_insert ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND private.learning_lesson_visible(course_id,lesson_id));
CREATE POLICY learning_progress_update ON public.lesson_progress FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND private.learning_lesson_visible(course_id,lesson_id));

CREATE OR REPLACE FUNCTION private.guard_learning_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME='courses' THEN
   IF OLD.published OR EXISTS(SELECT 1 FROM public.enrollments WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id=OLD.id) OR EXISTS(SELECT 1 FROM public.final_assignment_submissions WHERE course_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_COURSE_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_lessons' THEN
   IF OLD.published OR EXISTS(SELECT 1 FROM public.lesson_progress WHERE lesson_id=OLD.id) OR EXISTS(SELECT 1 FROM public.section_question_attempts WHERE lesson_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_LESSON_REQUIRED'; END IF;
 ELSIF TG_TABLE_NAME='course_sections' THEN
   IF EXISTS(SELECT 1 FROM public.course_lessons WHERE section_id=OLD.id) THEN RAISE EXCEPTION 'SECTION_NOT_EMPTY'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM public.section_question_attempts WHERE question_id=OLD.id) THEN RAISE EXCEPTION 'ARCHIVE_QUESTION_REQUIRED'; END IF;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION private.guard_learning_delete() FROM PUBLIC;
CREATE TRIGGER learning_delete_guard BEFORE DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION private.guard_learning_delete();
CREATE TRIGGER learning_delete_guard BEFORE DELETE ON public.course_lessons FOR EACH ROW EXECUTE FUNCTION private.guard_learning_delete();
CREATE TRIGGER learning_delete_guard BEFORE DELETE ON public.course_sections FOR EACH ROW EXECUTE FUNCTION private.guard_learning_delete();
CREATE TRIGGER learning_delete_guard BEFORE DELETE ON public.course_section_questions FOR EACH ROW EXECUTE FUNCTION private.guard_learning_delete();
