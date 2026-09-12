-- Preserve legacy batch quiz attempt behavior while avoiding REST exposure of a
-- SECURITY DEFINER public RPC that triggers Security Advisor warnings.

CREATE OR REPLACE FUNCTION private.submit_quiz_attempts__legacy(p_attempts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  results jsonb := '[]'::jsonb;
BEGIN
  IF p_attempts IS NULL OR jsonb_typeof(p_attempts) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: p_attempts must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_attempts) LOOP
    IF item -> 'selected_index' IS NULL OR item ->> 'selected_index' = '' THEN
      RAISE EXCEPTION 'INVALID_ARGUMENTS: selected_index is required.'
        USING ERRCODE = '22023';
    END IF;

    results := results || jsonb_build_array(public.submit_quiz_attempt(
      p_course_id => item->>'course_id',
      p_section_id => item->>'section_id',
      p_lesson_id => item->>'lesson_id',
      p_question_id => item->>'question_id',
      p_selected_index => (item->>'selected_index')::int
    ));
  END LOOP;

  RETURN results;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempts(p_attempts jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.submit_quiz_attempts__legacy(p_attempts);
$$;

REVOKE ALL ON FUNCTION private.submit_quiz_attempts__legacy(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.submit_quiz_attempts__legacy(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_quiz_attempts(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempts(jsonb) TO authenticated, service_role;
