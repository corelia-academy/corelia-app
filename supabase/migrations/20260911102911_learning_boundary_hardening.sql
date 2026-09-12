-- An enrollment cannot be moved to a different learner/course to carry completion.
CREATE FUNCTION private.learning_enrollment_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.course_id IS DISTINCT FROM OLD.course_id OR NEW.id IS DISTINCT FROM OLD.id THEN
   RAISE EXCEPTION 'ENROLLMENT_IDENTITY_IMMUTABLE' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_enrollment_identity_guard() FROM PUBLIC;
CREATE TRIGGER learning_enrollment_identity BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION private.learning_enrollment_identity_guard();

DROP POLICY storage_final_submissions_insert ON storage.objects;
CREATE POLICY storage_final_submissions_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='app' AND (storage.foldername(name))[1]='final-assignment-submissions'
 AND (storage.foldername(name))[3]=(SELECT auth.uid())::text
 AND private.learning_course_visible((storage.foldername(name))[2]));

-- Serialize question mutations against quiz submit's lesson lock, including
-- direct admin table calls that do not use the atomic authoring RPC.
CREATE FUNCTION private.learning_question_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP<>'INSERT' AND OLD.lesson_id IS NOT NULL THEN
   PERFORM 1 FROM public.course_lessons WHERE course_id=OLD.course_id AND id=OLD.lesson_id FOR UPDATE;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.lesson_id IS NOT NULL THEN
   PERFORM 1 FROM public.course_lessons WHERE course_id=NEW.course_id AND id=NEW.lesson_id FOR UPDATE;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_question_lock() FROM PUBLIC;
CREATE TRIGGER learning_question_lock BEFORE INSERT OR UPDATE OR DELETE ON public.course_section_questions
FOR EACH ROW EXECUTE FUNCTION private.learning_question_lock();

CREATE FUNCTION private.learning_content_shape_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d jsonb:=NEW.data; c jsonb; item jsonb; field text;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_CONTENT_OBJECT'; END IF;
 IF TG_TABLE_NAME='course_lesson_locales' AND d ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
 IF TG_TABLE_NAME='course_locales' AND d ?| ARRAY['instructors','has_certificate','final_assignment_fields','owner_type','co_instructor_permissions','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
 IF d ? 'resources' THEN
   IF jsonb_typeof(d->'resources') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_RESOURCES'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(d->'resources') LOOP
     IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'url') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_RESOURCE'; END IF;
     IF COALESCE(item->>'url','')<>'' AND item->>'url' !~ '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION 'INVALID_RESOURCE_URL'; END IF;
   END LOOP;
 END IF;
 IF TG_TABLE_NAME='course_lessons' THEN
   IF d ? 'quiz_config' THEN
     c:=d->'quiz_config';
     IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (c ? 'allow_retry' AND jsonb_typeof(c->'allow_retry') IS DISTINCT FROM 'boolean') OR (c ? 'passing_ratio' AND jsonb_typeof(c->'passing_ratio') IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'INVALID_QUIZ_CONFIG'; END IF;
   END IF;
   IF d ? 'practice_config' THEN
     c:=d->'practice_config';
     IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR COALESCE(c->>'mode','') NOT IN ('instruction','checklist','submission','guided_project') THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
     FOREACH field IN ARRAY ARRAY['checklist_items','project_steps','submission_fields'] LOOP
       IF c ? field AND jsonb_typeof(c->field) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
     END LOOP;
     IF c ? 'requires_review' AND jsonb_typeof(c->'requires_review') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'INVALID_PRACTICE_CONFIG'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_content_shape_guard() FROM PUBLIC;
CREATE TRIGGER learning_content_shape BEFORE INSERT OR UPDATE ON public.course_lessons FOR EACH ROW EXECUTE FUNCTION private.learning_content_shape_guard();
CREATE TRIGGER learning_content_shape BEFORE INSERT OR UPDATE ON public.course_lesson_locales FOR EACH ROW EXECUTE FUNCTION private.learning_content_shape_guard();
CREATE TRIGGER learning_content_shape BEFORE INSERT OR UPDATE ON public.course_locales FOR EACH ROW EXECUTE FUNCTION private.learning_content_shape_guard();

-- Course completion does not depend on a successful browser-to-Edge request.
CREATE FUNCTION private.learning_progress_completion_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at)
 VALUES(NEW.user_id::text||'_'||NEW.course_id,NEW.user_id,NEW.course_id,now(),now())
 ON CONFLICT(user_id,course_id) DO NOTHING;
 IF NEW.completed_at IS NOT NULL THEN PERFORM private.learning_sync_completion(NEW.course_id,NEW.user_id); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.learning_progress_completion_sync() FROM PUBLIC;
CREATE TRIGGER learning_progress_completion AFTER INSERT OR UPDATE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION private.learning_progress_completion_sync();
