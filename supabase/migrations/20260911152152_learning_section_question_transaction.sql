-- Preserve legacy section question identities and attempts in one atomic write.
CREATE FUNCTION private.learning_save_section_questions(p_course text,p_section text,p_questions jsonb,p_locale text DEFAULT NULL)
RETURNS SETOF public.course_section_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q jsonb; option_value jsonb; position_value integer; correct_value integer;
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'content') THEN
  RAISE EXCEPTION 'COURSE_CONTENT_PERMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.course_sections WHERE course_id=p_course AND id=p_section FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SECTION_REFERENCE'; END IF;
 IF p_locale IS NOT NULL AND p_locale NOT IN ('vi','en') THEN RAISE EXCEPTION 'INVALID_QUESTION_LOCALE'; END IF;
 IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_QUESTIONS'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_questions))<>jsonb_array_length(p_questions) THEN
  RAISE EXCEPTION 'DUPLICATE_QUESTION_ID';
 END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NULLIF(btrim(q->>'id'),'') IS NULL THEN RAISE EXCEPTION 'INVALID_QUESTION_ID'; END IF;
  IF EXISTS(SELECT 1 FROM public.course_section_questions existing WHERE existing.id=q->>'id' AND
    (existing.course_id<>p_course OR existing.section_id IS DISTINCT FROM p_section OR existing.lesson_id IS NOT NULL
     OR (p_locale IS NOT NULL AND existing.data->>'locale' IS DISTINCT FROM p_locale))) THEN
   RAISE EXCEPTION 'QUESTION_SCOPE_MISMATCH';
  END IF;
  IF q->>'type' IS DISTINCT FROM 'mcq' OR jsonb_typeof(q->'question') IS DISTINCT FROM 'string' OR btrim(q->>'question')='' OR
     jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_QUESTION'; END IF;
  IF jsonb_array_length(q->'options')<2 THEN RAISE EXCEPTION 'INVALID_QUESTION_OPTIONS'; END IF;
  FOR option_value IN SELECT value FROM jsonb_array_elements(q->'options') LOOP
   IF jsonb_typeof(option_value) IS DISTINCT FROM 'object' OR NULLIF(btrim(option_value->>'id'),'') IS NULL OR
      jsonb_typeof(option_value->'text') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_QUESTION_OPTIONS'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(q->'options'))<>jsonb_array_length(q->'options') OR
     (SELECT count(*) FROM jsonb_array_elements(q->'options') WHERE btrim(value->>'text')<>'')<2 THEN RAISE EXCEPTION 'INVALID_QUESTION_OPTIONS'; END IF;
  IF jsonb_typeof(q->'correct_index') IS DISTINCT FROM 'number' OR (q->>'correct_index') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'INVALID_CORRECT_INDEX'; END IF;
  correct_value:=(q->>'correct_index')::integer;
  IF correct_value>=jsonb_array_length(q->'options') OR btrim(q->'options'->correct_value->>'text')='' THEN RAISE EXCEPTION 'INVALID_CORRECT_INDEX'; END IF;
 END LOOP;
 UPDATE public.course_section_questions existing SET archived_at=COALESCE(existing.archived_at,now())
 WHERE existing.course_id=p_course AND existing.section_id=p_section AND existing.lesson_id IS NULL
   AND (p_locale IS NULL OR existing.data->>'locale'=p_locale)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_questions) item WHERE item->>'id'=existing.id);
 FOR q,position_value IN SELECT value,ordinality::integer-1 FROM jsonb_array_elements(p_questions) WITH ORDINALITY LOOP
  INSERT INTO public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data,archived_at)
  VALUES(q->>'id',p_course,p_section,NULL,position_value,
   (q-ARRAY['id','order','course_id','section_id','lesson_id','archived_at']) || CASE WHEN p_locale IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('locale',p_locale) END,NULL)
  ON CONFLICT(id) DO UPDATE SET sort_order=EXCLUDED.sort_order,data=EXCLUDED.data,archived_at=NULL
  WHERE public.course_section_questions.course_id=p_course AND public.course_section_questions.section_id=p_section
    AND public.course_section_questions.lesson_id IS NULL
    AND (p_locale IS NULL OR public.course_section_questions.data->>'locale'=p_locale);
  IF NOT FOUND THEN RAISE EXCEPTION 'QUESTION_SCOPE_MISMATCH'; END IF;
 END LOOP;
 RETURN QUERY SELECT existing.* FROM public.course_section_questions existing
 WHERE existing.course_id=p_course AND existing.section_id=p_section AND existing.lesson_id IS NULL AND existing.archived_at IS NULL
  AND (p_locale IS NULL OR existing.data->>'locale'=p_locale) ORDER BY existing.sort_order,existing.id;
END $$;
CREATE FUNCTION public.learning_save_section_questions(p_course text,p_section text,p_questions jsonb,p_locale text DEFAULT NULL)
RETURNS SETOF public.course_section_questions LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM private.learning_save_section_questions(p_course,p_section,p_questions,p_locale);
$$;
REVOKE ALL ON FUNCTION private.learning_save_section_questions(text,text,jsonb,text),public.learning_save_section_questions(text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.learning_save_section_questions(text,text,jsonb,text),public.learning_save_section_questions(text,text,jsonb,text) TO authenticated;
