-- Preserve the old batch RPC contract while using canonical lesson grading.
-- Section quizzes keep their existing authorization/scoring implementation.
CREATE OR REPLACE FUNCTION public.submit_quiz_attempts(p_attempts jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; results jsonb:='[]'; answers jsonb; course_value text; lesson_value text; request_value uuid; BEGIN
 IF p_attempts IS NULL OR jsonb_typeof(p_attempts)<>'array' THEN RAISE EXCEPTION 'INVALID_ARGUMENTS: p_attempts must be a JSON array.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_attempts) x WHERE NULLIF(x->>'lesson_id','') IS NOT NULL) THEN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  course_value:=p_attempts->0->>'course_id'; lesson_value:=p_attempts->0->>'lesson_id';
  IF course_value IS NULL OR lesson_value IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_attempts) x WHERE x->>'course_id' IS DISTINCT FROM course_value OR x->>'lesson_id' IS DISTINCT FROM lesson_value OR NULLIF(x->>'section_id','') IS NOT NULL OR jsonb_typeof(x->'selected_index') IS DISTINCT FROM 'number' OR NULLIF(x->>'question_id','') IS NULL) THEN RAISE EXCEPTION 'INVALID_QUIZ_BATCH' USING ERRCODE='22023'; END IF;
  IF (SELECT count(DISTINCT x->>'question_id') FROM jsonb_array_elements(p_attempts) x)<>jsonb_array_length(p_attempts) THEN RAISE EXCEPTION 'DUPLICATE_QUESTION_ID' USING ERRCODE='22023'; END IF;
  SELECT jsonb_object_agg(x->>'question_id',x->'selected_index') INTO answers FROM jsonb_array_elements(p_attempts) x;
  -- Old clients have no request ID. Identical payloads replay the first result,
  -- including after reload; changed answers create a new request subject to retry policy.
  request_value:=md5(jsonb_build_array('learning-legacy-batch-v1',auth.uid(),course_value,lesson_value,answers)::text)::uuid;
  results:=private.learning_quiz_submit(course_value,lesson_value,request_value,answers);
  RETURN results->'attempts';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_attempts) LOOP
  results:=results||jsonb_build_array(public.submit_quiz_attempt(item->>'course_id',item->>'section_id',item->>'lesson_id',item->>'question_id',(item->>'selected_index')::int));
 END LOOP;
 RETURN results;
END $$;
REVOKE ALL ON FUNCTION public.submit_quiz_attempts(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempts(jsonb) TO authenticated;
