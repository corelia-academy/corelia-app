-- Batch update sort_order for course_sections in a single RPC call.
-- Mirrors batch_update_lesson_orders: SECURITY INVOKER so RLS applies,
-- restricted to authenticated users only.

CREATE OR REPLACE FUNCTION public.batch_update_section_orders(
  p_course_id text,
  p_updates    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE course_sections AS cs
  SET sort_order = (u.value->>'sort_order')::int
  FROM jsonb_array_elements(p_updates) AS u
  WHERE cs.id        = u.value->>'id'
    AND cs.course_id = p_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_update_section_orders(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_update_section_orders(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.batch_update_section_orders(text, jsonb) TO authenticated;
