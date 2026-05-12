-- Fix linter warnings: batch_update_lesson_orders must not be SECURITY DEFINER
-- and must not be callable by anon.

CREATE OR REPLACE FUNCTION public.batch_update_lesson_orders(
  p_course_id text,
  p_updates    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE course_lessons AS cl
  SET
    sort_order = (u.value->>'sort_order')::int,
    section_id = u.value->>'section_id'
  FROM jsonb_array_elements(p_updates) AS u
  WHERE cl.id        = u.value->>'id'
    AND cl.course_id = p_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_update_lesson_orders(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_update_lesson_orders(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.batch_update_lesson_orders(text, jsonb) TO authenticated;

