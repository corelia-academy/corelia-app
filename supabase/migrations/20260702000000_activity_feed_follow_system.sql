-- Activity feed + follow system.
-- Polymorphic ids are text because courses/hackathons use text ids while
-- profiles/projects use uuid ids.

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Counters
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.hackathons
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'profiles'
      AND c.conname = 'profiles_follower_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_follower_count_non_negative_chk CHECK (follower_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'profiles'
      AND c.conname = 'profiles_following_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_following_count_non_negative_chk CHECK (following_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'courses'
      AND c.conname = 'courses_follower_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_follower_count_non_negative_chk CHECK (follower_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'hackathons'
      AND c.conname = 'hackathons_follower_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.hackathons
      ADD CONSTRAINT hackathons_follower_count_non_negative_chk CHECK (follower_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'projects'
      AND c.conname = 'projects_follower_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_follower_count_non_negative_chk CHECK (follower_count >= 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject_type text NOT NULL
    CHECK (subject_type IN ('user', 'course', 'hackathon', 'project')),
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  muted_until timestamptz,
  PRIMARY KEY (follower_id, subject_type, subject_id),
  CONSTRAINT follows_no_self_user_follow_chk
    CHECK (subject_type <> 'user' OR subject_id <> follower_id::text)
);

CREATE INDEX IF NOT EXISTS follows_subject_idx
  ON public.follows (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS follows_follower_idx
  ON public.follows (follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id bigserial PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  verb text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'private')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_actor_time_idx
  ON public.activity_events (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_object_time_idx
  ON public.activity_events (object_type, object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_target_time_idx
  ON public.activity_events (target_type, target_id, created_at DESC)
  WHERE target_type IS NOT NULL AND target_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_verb_time_idx
  ON public.activity_events (verb, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_created_time_idx
  ON public.activity_events (created_at DESC);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_uuid_text(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION private.is_followable_subject(
  p_subject_type text,
  p_subject_id text,
  p_follower_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_subject_id::uuid
        AND COALESCE(p.profile_public, false) = true
        AND (p_follower_id IS NULL OR p.id <> p_follower_id)
    );
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_subject_id
        AND c.published = true
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND h.status IN ('published', 'running', 'ended', 'winners_announced')
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = p_subject_id::uuid
        AND p.visibility = 'public'
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_read_activity_subject(
  p_subject_type text,
  p_subject_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RETURN true;
  END IF;

  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_subject_id::uuid
        AND (
          COALESCE(p.profile_public, false) = true
          OR p.id = p_user_id
          OR public.is_admin_or_support()
        )
    );
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_subject_id
        AND (
          c.published = true
          OR c.instructor_id = p_user_id
          OR public.is_admin_or_support()
          OR COALESCE(c.data->'co_instructor_permissions', '{}'::jsonb) ? COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND (
          h.status IN ('published', 'running', 'ended', 'winners_announced')
          OR public.is_admin_or_support()
          OR (h.document->>'created_by') = COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN private.can_read_project_content(p_subject_id::uuid, p_user_id);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_read_activity(
  p_event_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_event public.activity_events%ROWTYPE;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT *
  INTO v_event
  FROM public.activity_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN true;
  END IF;

  IF v_event.visibility = 'private' THEN
    RETURN p_user_id IS NOT NULL AND v_event.actor_id = p_user_id;
  END IF;

  IF v_event.visibility = 'followers' THEN
    IF p_user_id IS NULL THEN
      RETURN false;
    END IF;

    IF v_event.actor_id <> p_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.follower_id = p_user_id
          AND f.subject_type = 'user'
          AND f.subject_id = v_event.actor_id::text
          AND (f.muted_until IS NULL OR f.muted_until < now())
      )
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN private.can_read_activity_subject(v_event.object_type, v_event.object_id, p_user_id)
    AND private.can_read_activity_subject(v_event.target_type, v_event.target_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.log_activity(
  p_actor_id uuid,
  p_verb text,
  p_object_type text,
  p_object_id text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_visibility text DEFAULT 'public'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_ACTOR_REQUIRED';
  END IF;

  IF p_object_type IS NULL OR trim(p_object_type) = ''
    OR p_object_id IS NULL OR trim(p_object_id) = ''
  THEN
    RAISE EXCEPTION 'ACTIVITY_OBJECT_REQUIRED';
  END IF;

  IF p_visibility NOT IN ('public', 'followers', 'private') THEN
    RAISE EXCEPTION 'ACTIVITY_VISIBILITY_INVALID';
  END IF;

  INSERT INTO public.activity_events (
    actor_id,
    verb,
    object_type,
    object_id,
    target_type,
    target_id,
    payload,
    visibility
  )
  VALUES (
    p_actor_id,
    p_verb,
    p_object_type,
    p_object_id,
    p_target_type,
    p_target_id,
    COALESCE(p_payload, '{}'::jsonb),
    p_visibility
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION private.is_followable_subject(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_activity_subject(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_activity(bigint, uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.follows_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.follower_id IS DISTINCT FROM OLD.follower_id
      OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
      OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'FOLLOW_MUTED_UNTIL_ONLY';
    END IF;

    RETURN NEW;
  END IF;

  IF NOT private.is_followable_subject(NEW.subject_type, NEW.subject_id, NEW.follower_id) THEN
    RAISE EXCEPTION 'FOLLOW_SUBJECT_NOT_FOLLOWABLE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follows_before_write ON public.follows;
CREATE TRIGGER trg_follows_before_write
  BEFORE INSERT OR UPDATE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION private.follows_before_write();

CREATE OR REPLACE FUNCTION private.follows_adjust_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_delta integer;
  v_follower_id uuid;
  v_subject_type text;
  v_subject_id text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    v_follower_id := NEW.follower_id;
    v_subject_type := NEW.subject_type;
    v_subject_id := NEW.subject_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -1;
    v_follower_id := OLD.follower_id;
    v_subject_type := OLD.subject_type;
    v_subject_id := OLD.subject_id;
  ELSE
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET following_count = GREATEST(0, following_count + v_delta)
  WHERE id = v_follower_id;

  IF v_subject_type = 'user' AND private.is_uuid_text(v_subject_id) THEN
    UPDATE public.profiles
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id::uuid;
  ELSIF v_subject_type = 'course' THEN
    UPDATE public.courses
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id;
  ELSIF v_subject_type = 'hackathon' THEN
    UPDATE public.hackathons
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id;
  ELSIF v_subject_type = 'project' AND private.is_uuid_text(v_subject_id) THEN
    UPDATE public.projects
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id::uuid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_follows_adjust_counts ON public.follows;
CREATE TRIGGER trg_follows_adjust_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION private.follows_adjust_counts();

CREATE OR REPLACE FUNCTION private.follows_emit_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.log_activity(
    NEW.follower_id,
    'user.followed_' || NEW.subject_type,
    'user',
    NEW.follower_id::text,
    NEW.subject_type,
    NEW.subject_id,
    jsonb_build_object(
      'subject_type', NEW.subject_type,
      'subject_id', NEW.subject_id
    ),
    'public'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follows_emit_activity ON public.follows;
CREATE TRIGGER trg_follows_emit_activity
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION private.follows_emit_activity();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select_own_or_staff ON public.follows;
CREATE POLICY follows_select_own_or_staff
  ON public.follows FOR SELECT
  TO authenticated
  USING (
    follower_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (
    follower_id = (SELECT auth.uid())
    AND private.is_followable_subject(subject_type, subject_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS follows_update_own_mute ON public.follows;
CREATE POLICY follows_update_own_mute
  ON public.follows FOR UPDATE
  TO authenticated
  USING (follower_id = (SELECT auth.uid()))
  WITH CHECK (follower_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS activity_events_select_visible ON public.activity_events;
CREATE POLICY activity_events_select_visible
  ON public.activity_events FOR SELECT
  TO anon, authenticated
  USING (
    private.can_read_activity(id, (SELECT auth.uid()))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.activity_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.activity_events_id_seq TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Feed RPC
-- -----------------------------------------------------------------------------

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
  WITH followed AS (
    SELECT subject_type, subject_id
    FROM public.follows
    WHERE follower_id = (SELECT auth.uid())
      AND (muted_until IS NULL OR muted_until < now())
  )
  SELECT e.*
  FROM public.activity_events e
  WHERE e.created_at < COALESCE(p_cursor, 'infinity'::timestamptz)
    AND (p_filter IS NULL OR e.verb = ANY(p_filter))
    AND (
      e.actor_id = (SELECT auth.uid())
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

GRANT EXECUTE ON FUNCTION public.get_feed_v1(timestamptz, integer, text[]) TO authenticated;
