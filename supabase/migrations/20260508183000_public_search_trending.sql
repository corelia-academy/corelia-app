-- Trending searches (public)
-- - Log search submissions (authenticated only) to reduce spam.
-- - Provide RPC to list trending queries in last 7 days.

CREATE TABLE IF NOT EXISTS public.search_query_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_query_events_created_at_idx
  ON public.search_query_events (created_at DESC);

CREATE INDEX IF NOT EXISTS search_query_events_query_trgm_idx
  ON public.search_query_events USING gin (query gin_trgm_ops);

ALTER TABLE public.search_query_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_query_events_insert_own ON public.search_query_events;
CREATE POLICY search_query_events_insert_own
  ON public.search_query_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND length(trim(query)) >= 2
    AND length(query) <= 200
  );

-- No client reads.
REVOKE SELECT, UPDATE, DELETE ON public.search_query_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_search_query(p_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.search_query_events (user_id, query)
  VALUES (auth.uid(), left(trim(coalesce(p_query, '')), 200));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_search_query(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_trending_searches(p_limit int DEFAULT 8)
RETURNS TABLE (
  query text,
  searches bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    lower(trim(e.query)) as query,
    count(*) as searches
  FROM public.search_query_events e
  WHERE e.created_at >= now() - interval '7 days'
    AND length(trim(e.query)) >= 2
  GROUP BY lower(trim(e.query))
  ORDER BY count(*) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
$$;

GRANT EXECUTE ON FUNCTION public.list_trending_searches(int) TO anon, authenticated;

