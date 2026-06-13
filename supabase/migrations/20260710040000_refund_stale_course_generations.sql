-- Refund AI course-generation reservations that got stuck in `pending`.
-- Intended for a service-role scheduled job or a staff/admin manual action.

CREATE OR REPLACE FUNCTION public.refund_stale_course_generations(
  p_older_than interval DEFAULT interval '10 minutes',
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_row record;
  v_refunded_count int := 0;
  v_refunded_cost int := 0;
  v_month text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.ai_course_generations
    WHERE status = 'pending'
      AND created_at < now() - greatest(p_older_than, interval '1 minute')
    ORDER BY created_at
    LIMIT greatest(1, least(COALESCE(p_limit, 100), 500))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_month := private.month_key(v_row.created_at);

    UPDATE public.ai_usage_monthly
    SET
      message_count = greatest(0, message_count - v_row.estimated_cost),
      updated_at = now()
    WHERE user_id = v_row.user_id
      AND month = v_month;

    UPDATE public.ai_course_generations
    SET
      status = 'refunded',
      actual_cost = 0,
      error = 'stale_pending_refund',
      completed_at = now()
    WHERE id = v_row.id;

    v_refunded_count := v_refunded_count + 1;
    v_refunded_cost := v_refunded_cost + v_row.estimated_cost;
  END LOOP;

  RETURN jsonb_build_object(
    'refunded_count', v_refunded_count,
    'refunded_cost', v_refunded_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_stale_course_generations(interval, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_stale_course_generations(interval, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_stale_course_generations(interval, int) TO authenticated;
