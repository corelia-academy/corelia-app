-- Preserve legacy content while allowing metadata-only unpublish/archive.
-- Changed content and every publication still run the existing validators.
CREATE OR REPLACE FUNCTION private.learning_content_shape_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d jsonb:=NEW.data; c jsonb; item jsonb; field text;
BEGIN
 -- Metadata-only retirement must remain possible for pre-enforcement content.
 IF TG_TABLE_NAME='course_lessons' AND TG_OP='UPDATE' THEN
   IF NEW.data IS NOT DISTINCT FROM OLD.data AND (NOT NEW.published OR NEW.archived_at IS NOT NULL) THEN RETURN NEW; END IF;
 END IF;
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
   FOR l IN SELECT * FROM public.course_lessons WHERE course_id=CASE WHEN TG_OP='DELETE' THEN OLD.course_id ELSE NEW.course_id END AND id=CASE WHEN TG_OP='DELETE' THEN OLD.lesson_id ELSE NEW.lesson_id END AND published AND archived_at IS NULL LOOP
     errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
     IF TG_TABLE_NAME='course_lesson_locales' AND TG_OP<>'DELETE' THEN
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

REVOKE ALL ON FUNCTION private.learning_content_shape_guard(),private.learning_publication_guard() FROM PUBLIC;
