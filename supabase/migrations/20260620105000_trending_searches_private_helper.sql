CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.list_trending_searches_impl(p_limit int DEFAULT 8)
RETURNS TABLE (
  query text,
  searches bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    lower(trim(e.query)) AS query,
    count(*) AS searches
  FROM public.search_query_events e
  WHERE e.created_at >= now() - interval '7 days'
    AND length(trim(e.query)) >= 2
  GROUP BY lower(trim(e.query))
  ORDER BY count(*) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
$$;

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
  SELECT *
  FROM private.list_trending_searches_impl(p_limit);
$$;

GRANT EXECUTE ON FUNCTION private.list_trending_searches_impl(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_trending_searches(int) TO anon, authenticated;
