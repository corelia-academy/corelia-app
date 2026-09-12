-- Locale mutations participate in the same parent lock as publication and quiz submit.
CREATE OR REPLACE FUNCTION private.learning_question_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.course_lessons WHERE
   (course_id=CASE WHEN TG_OP<>'INSERT' THEN OLD.course_id END AND id=CASE WHEN TG_OP<>'INSERT' THEN OLD.lesson_id END)
   OR (course_id=CASE WHEN TG_OP<>'DELETE' THEN NEW.course_id END AND id=CASE WHEN TG_OP<>'DELETE' THEN NEW.lesson_id END)
 ORDER BY course_id,id FOR UPDATE;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_question_lock() FROM PUBLIC;
CREATE TRIGGER learning_locale_parent_lock BEFORE INSERT OR UPDATE OR DELETE ON public.course_lesson_locales
FOR EACH ROW EXECUTE FUNCTION private.learning_question_lock();

CREATE OR REPLACE FUNCTION private.learning_publication_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE errors text[]; l public.course_lessons%ROWTYPE; course_id_value text; d jsonb; BEGIN
 IF TG_TABLE_NAME='course_lessons' THEN
   SELECT * INTO l FROM public.course_lessons WHERE id=NEW.id AND course_id=NEW.course_id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   IF TG_OP='UPDATE' THEN
     IF l.data IS NOT DISTINCT FROM OLD.data AND (NOT l.published OR l.archived_at IS NOT NULL) THEN RETURN NULL; END IF;
   END IF;
   IF l.data->>'lesson_format'='code_exercise' THEN
     errors:=private.learning_code_errors(l.data->'code_exercise_config',false);
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'INVALID_CODE_CONFIG: %',array_to_string(errors,','); END IF;
   END IF;
   IF l.published AND l.archived_at IS NULL THEN
     errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %',array_to_string(errors,','); END IF;
   END IF;
 ELSIF TG_TABLE_NAME IN ('course_section_questions','course_lesson_locales') THEN
   -- A move changes both curricula. Validate the source as well as destination.
   FOR l IN SELECT * FROM public.course_lessons WHERE published AND archived_at IS NULL AND (
     (course_id=CASE WHEN TG_OP<>'INSERT' THEN OLD.course_id END AND id=CASE WHEN TG_OP<>'INSERT' THEN OLD.lesson_id END)
     OR (course_id=CASE WHEN TG_OP<>'DELETE' THEN NEW.course_id END AND id=CASE WHEN TG_OP<>'DELETE' THEN NEW.lesson_id END)
   ) LOOP
     errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
     IF TG_TABLE_NAME='course_lesson_locales' AND TG_OP<>'DELETE' AND l.course_id=NEW.course_id AND l.id=NEW.lesson_id THEN
       -- Machine configuration belongs to the master, never locale records.
       IF NEW.data ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
       errors:=errors||private.learning_lesson_errors(l.id,l.data||NEW.data,l.course_id);
     END IF;
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %',array_to_string(errors,','); END IF;
   END LOOP;
 ELSE
   course_id_value:=CASE WHEN TG_TABLE_NAME='courses' THEN to_jsonb(NEW)->>'id' ELSE to_jsonb(NEW)->>'course_id' END;
   SELECT data INTO d FROM public.courses WHERE id=course_id_value AND published AND archived_at IS NULL;
   IF FOUND THEN
     IF COALESCE(btrim(d->>'title'),'')='' OR NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL) THEN RAISE EXCEPTION 'COURSE_NOT_PUBLISHABLE'; END IF;
     IF NULLIF(btrim(d->>'final_assignment_title'),'') IS NOT NULL AND COALESCE(btrim(d->>'final_assignment_instructions'),'')='' THEN RAISE EXCEPTION 'FINAL_INSTRUCTIONS_REQUIRED'; END IF;
     FOR l IN SELECT * FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL LOOP
       errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
       IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',l.id,array_to_string(errors,','); END IF;
     END LOOP;
   END IF;
 END IF;
 RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.learning_publication_guard() FROM PUBLIC;
