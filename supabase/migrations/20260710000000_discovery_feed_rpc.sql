-- -----------------------------------------------------------------------------
-- Discovery Feed RPC
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_discovery_feed(
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.activity_events
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  WITH followed AS (
    SELECT subject_type, subject_id
    FROM public.follows
    WHERE follower_id = (SELECT auth.uid())
      AND (muted_until IS NULL OR muted_until < now())
  )
  SELECT e.*
  FROM public.activity_events e
  WHERE e.created_at < COALESCE(p_cursor, 'infinity'::timestamptz)
    -- Exclude own events
    AND (e.actor_id != (SELECT auth.uid()) OR (SELECT auth.uid()) IS NULL)
    
    -- Filter trending content (like_count >= 5 OR registrations >= 10 OR course/hackathon)
    AND (
      (e.payload->>'like_count')::int >= 5 OR
      (e.payload->>'registrations')::int >= 10 OR
      e.object_type IN ('course', 'hackathon')
    )
    
    -- Exclude actors user already follows
    AND NOT EXISTS (
      SELECT 1
      FROM followed f
      WHERE f.subject_type = 'user'
        AND f.subject_id = e.actor_id::text
    )
    
    -- Exclude objects/targets user already follows
    AND NOT EXISTS (
      SELECT 1
      FROM followed f
      WHERE (f.subject_type, f.subject_id) IN (
        (e.object_type, e.object_id),
        (COALESCE(e.target_type, ''), COALESCE(e.target_id, ''))
      )
    )
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_discovery_feed(timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(timestamptz, integer) TO anon;
