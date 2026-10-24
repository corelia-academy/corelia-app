-- Shared server-side rate limit for Edge operations that spend money (AI,
-- email) or fan out work. Callers are Edge Functions using the service role;
-- browser clients cannot consume or inspect buckets directly.

CREATE TABLE IF NOT EXISTS private.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket ~ '^[a-z0-9_.:-]{1,64}$'),
  subject uuid NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_subject_time
  ON private.rate_limit_hits(bucket,subject,hit_at);
CREATE INDEX IF NOT EXISTS rate_limit_hits_time
  ON private.rate_limit_hits(hit_at);
ALTER TABLE private.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.rate_limit_hits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON private.rate_limit_hits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket text,
  p_subject uuid,
  p_limit integer,
  p_window_seconds integer
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_since timestamptz;
  v_used bigint;
BEGIN
  IF p_bucket IS NULL OR p_subject IS NULL OR p_limit IS NULL OR p_limit < 1
    OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_input:rate_limit';
  END IF;
  v_since := v_now - pg_catalog.make_interval(secs => p_window_seconds);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('rate-limit:' || p_bucket || ':' || p_subject::text,0)
  );

  SELECT count(*) INTO v_used
  FROM private.rate_limit_hits
  WHERE bucket=p_bucket AND subject=p_subject AND hit_at > v_since;
  IF v_used >= p_limit THEN
    RAISE EXCEPTION 'rate_limited:%', p_bucket;
  END IF;

  INSERT INTO private.rate_limit_hits(bucket,subject,hit_at)
  VALUES(p_bucket,p_subject,v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,uuid,integer,integer) TO service_role;

-- Windows are capped at one day, so older hits never affect a decision.
SELECT cron.schedule(
  'corelia-rate-limit-cleanup',
  '17 * * * *',
  $cron$DELETE FROM private.rate_limit_hits WHERE hit_at < now() - interval '1 day'$cron$
);
