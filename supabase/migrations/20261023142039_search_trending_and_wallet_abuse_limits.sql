-- Search trending: one account must not be able to push a query to the public
-- trending list or grow the event log without bound.

-- Rank by distinct searchers instead of raw event count.
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
    count(DISTINCT e.user_id) AS searches
  FROM public.search_query_events e
  WHERE e.created_at >= now() - interval '7 days'
    AND length(trim(e.query)) >= 2
  GROUP BY lower(trim(e.query))
  ORDER BY count(DISTINCT e.user_id) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
$$;

CREATE INDEX IF NOT EXISTS search_query_events_user_time_idx
  ON public.search_query_events (user_id, created_at DESC);

-- Silently drop repeats of the same query within 10 minutes and anything past
-- 60 events per user per hour; logging is best-effort, so callers see no error.
CREATE OR REPLACE FUNCTION private.throttle_search_query_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.search_query_events e
    WHERE e.user_id = NEW.user_id
      AND e.created_at > now() - interval '10 minutes'
      AND lower(trim(e.query)) = lower(trim(NEW.query))
  ) THEN
    RETURN NULL;
  END IF;
  IF (
    SELECT count(*) FROM public.search_query_events e
    WHERE e.user_id = NEW.user_id AND e.created_at > now() - interval '1 hour'
  ) >= 60 THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.throttle_search_query_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS search_query_events_throttle ON public.search_query_events;
CREATE TRIGGER search_query_events_throttle
  BEFORE INSERT ON public.search_query_events
  FOR EACH ROW EXECUTE FUNCTION private.throttle_search_query_event();

-- Trending reads 7 days; keep 30 for analysis.
SELECT cron.schedule(
  'corelia-search-query-events-retention',
  '23 3 * * *',
  $cron$DELETE FROM public.search_query_events WHERE created_at < now() - interval '30 days'$cron$
);

-- Wallet challenges live 5 minutes; nothing references them after consumption.
SELECT cron.schedule(
  'corelia-wallet-challenge-cleanup',
  '41 * * * *',
  $cron$DELETE FROM public.wallet_link_challenges WHERE expires_at < now() - interval '1 day'$cron$
);
