-- -----------------------------------------------------------------------------
-- Báo cáo Email (Weekly Digest) & Anti-abuse (Mute/Block)
-- Issue: #208
-- -----------------------------------------------------------------------------

-- 1. Thêm cột cấu hình Email Digest
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_activity_digest boolean DEFAULT true;

-- 2. Tạo bảng user_blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_blocks_select ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = (SELECT auth.uid()) OR blocked_id = (SELECT auth.uid()));

CREATE POLICY user_blocks_insert ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (SELECT auth.uid()));

CREATE POLICY user_blocks_delete ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

-- 3. Tạo bảng user_mutes
CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (muter_id, muted_id)
);

CREATE INDEX IF NOT EXISTS user_mutes_muted_id_idx ON public.user_mutes(muted_id);

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_mutes_select ON public.user_mutes
  FOR SELECT TO authenticated
  USING (muter_id = (SELECT auth.uid()));

CREATE POLICY user_mutes_insert ON public.user_mutes
  FOR INSERT TO authenticated
  WITH CHECK (muter_id = (SELECT auth.uid()));

CREATE POLICY user_mutes_delete ON public.user_mutes
  FOR DELETE TO authenticated
  USING (muter_id = (SELECT auth.uid()));

-- 4. Cập nhật RLS Policy của activity_events
DROP POLICY IF EXISTS activity_events_select_visible ON public.activity_events;

CREATE POLICY activity_events_select_visible
  ON public.activity_events FOR SELECT
  TO anon, authenticated
  USING (
    private.can_read_activity(id, (SELECT auth.uid()))
    AND (
      (SELECT auth.uid()) IS NULL
      OR actor_id NOT IN (
        -- Blocked (2-way)
        SELECT blocked_id FROM public.user_blocks WHERE blocker_id = (SELECT auth.uid())
        UNION
        SELECT blocker_id FROM public.user_blocks WHERE blocked_id = (SELECT auth.uid())
        UNION
        -- Muted (1-way)
        SELECT muted_id FROM public.user_mutes WHERE muter_id = (SELECT auth.uid())
      )
    )
  );

-- 5. Cập nhật get_feed_v1 để lọc chặn
CREATE OR REPLACE FUNCTION public.get_feed_v1(
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_filter text[] DEFAULT NULL
)
RETURNS SETOF public.activity_events
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  WITH current_user_id AS (
    SELECT auth.uid() AS uid
  ),
  followed AS (
    SELECT subject_type, subject_id
    FROM public.follows, current_user_id
    WHERE follower_id = current_user_id.uid
      AND (muted_until IS NULL OR muted_until < now())
  ),
  hidden_users AS (
    SELECT blocked_id AS id FROM public.user_blocks, current_user_id WHERE blocker_id = current_user_id.uid
    UNION
    SELECT blocker_id AS id FROM public.user_blocks, current_user_id WHERE blocked_id = current_user_id.uid
    UNION
    SELECT muted_id AS id FROM public.user_mutes, current_user_id WHERE muter_id = current_user_id.uid
  )
  SELECT e.*
  FROM public.activity_events e
  WHERE e.created_at < COALESCE(p_cursor, 'infinity'::timestamptz)
    AND (p_filter IS NULL OR e.verb = ANY(p_filter))
    AND e.actor_id NOT IN (SELECT id FROM hidden_users)
    AND (
      e.actor_id = (SELECT uid FROM current_user_id)
      OR EXISTS (
        SELECT 1
        FROM followed f
        WHERE f.subject_type = 'user'
          AND f.subject_id = e.actor_id::text
      )
      OR EXISTS (
        SELECT 1
        FROM followed f
        WHERE (f.subject_type, f.subject_id) IN (
          (e.object_type, e.object_id),
          (COALESCE(e.target_type, ''), COALESCE(e.target_id, ''))
        )
      )
    )
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

-- 6. Cập nhật get_discovery_feed để lọc chặn
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
  WITH current_user_id AS (
    SELECT auth.uid() AS uid
  ),
  followed AS (
    SELECT subject_type, subject_id
    FROM public.follows, current_user_id
    WHERE follower_id = current_user_id.uid
      AND (muted_until IS NULL OR muted_until < now())
  ),
  hidden_users AS (
    SELECT blocked_id AS id FROM public.user_blocks, current_user_id WHERE blocker_id = current_user_id.uid
    UNION
    SELECT blocker_id AS id FROM public.user_blocks, current_user_id WHERE blocked_id = current_user_id.uid
    UNION
    SELECT muted_id AS id FROM public.user_mutes, current_user_id WHERE muter_id = current_user_id.uid
  )
  SELECT e.*
  FROM public.activity_events e
  WHERE e.created_at < COALESCE(p_cursor, 'infinity'::timestamptz)
    AND (e.actor_id != (SELECT uid FROM current_user_id) OR (SELECT uid FROM current_user_id) IS NULL)
    AND e.actor_id NOT IN (SELECT id FROM hidden_users)
    AND (
      (e.payload->>'like_count')::int >= 5 OR
      (e.payload->>'registrations')::int >= 10 OR
      e.object_type IN ('course', 'hackathon')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM followed f
      WHERE f.subject_type = 'user'
        AND f.subject_id = e.actor_id::text
    )
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

-- 7. Cấu hình pg_cron để gọi Edge Function hàng tuần (Thứ Hai 09:00 AM)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    PERFORM cron.schedule(
      'feed-weekly-digest',
      '0 9 * * 1',
      $$
      SELECT net.http_post(
          url:='http://supabase_kong:8000/functions/v1/feed-weekly-digest',
          headers:='{"Content-Type": "application/json"}'::jsonb,
          body:='{}'::jsonb
      )
      $$
    );
  END IF;
END $$;
