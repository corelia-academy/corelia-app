-- AUD-19: metadata and the active locale are one Save, including unpublish.
-- Invoker rights preserve the existing owner/staff table policies and grants.
CREATE FUNCTION public.learning_save_course_info(p_course text,p_patch jsonb,p_locale text,p_copy jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_course public.courses%ROWTYPE; copy_value jsonb; field_name text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_copy) IS DISTINCT FROM 'object'
    OR p_locale NOT IN ('vi','en') OR p_locale IS NULL
    OR p_patch ?| ARRAY['id','instructor_id','archived_at','created_at','updated_at']
    OR (p_patch ? 'published' AND jsonb_typeof(p_patch->'published') IS DISTINCT FROM 'boolean')
    OR (p_patch ? 'slug' AND (jsonb_typeof(p_patch->'slug') IS DISTINCT FROM 'string' OR btrim(p_patch->>'slug')=''))
 THEN RAISE EXCEPTION 'INVALID_COURSE_SAVE'; END IF;
 FOREACH copy_value IN ARRAY ARRAY[p_patch,p_copy] LOOP
  FOREACH field_name IN ARRAY ARRAY['title','description','short_description','final_assignment_title','final_assignment_description','final_assignment_instructions'] LOOP
   IF copy_value ? field_name AND jsonb_typeof(copy_value->field_name) IS DISTINCT FROM 'string'
      AND NOT (field_name LIKE 'final_assignment_%' AND copy_value->field_name='null'::jsonb)
   THEN RAISE EXCEPTION 'INVALID_COURSE_COPY'; END IF;
  END LOOP;
  IF copy_value ? 'learning_outcomes' THEN
   IF jsonb_typeof(copy_value->'learning_outcomes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_COURSE_COPY'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(copy_value->'learning_outcomes') item WHERE jsonb_typeof(item) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'INVALID_COURSE_COPY'; END IF;
  END IF;
 END LOOP;
 SELECT * INTO current_course FROM public.courses WHERE id=p_course FOR UPDATE;
 IF NOT FOUND OR NOT private.can_manage_course(p_course,auth.uid()) THEN
   RAISE EXCEPTION 'COURSE_MANAGE_PERMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 UPDATE public.courses SET
   data=data||(p_patch-ARRAY['slug','published']),
   slug=CASE WHEN p_patch ? 'slug' THEN p_patch->>'slug' ELSE slug END,
   published=CASE WHEN p_patch ? 'published' THEN (p_patch->>'published')::boolean ELSE published END,
   updated_at=clock_timestamp()
 WHERE id=p_course;
 IF NOT FOUND THEN RAISE EXCEPTION 'COURSE_NOT_FOUND'; END IF;
 INSERT INTO public.course_locales(course_id,locale,data)
 VALUES(p_course,p_locale,p_copy||jsonb_build_object('updated_at',clock_timestamp()))
 ON CONFLICT(course_id,locale) DO UPDATE SET data=public.course_locales.data||EXCLUDED.data;
 -- Deferred publication checks observe the final course + locale together.
END $$;
REVOKE ALL ON FUNCTION public.learning_save_course_info(text,jsonb,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.learning_save_course_info(text,jsonb,text,jsonb) TO authenticated;
