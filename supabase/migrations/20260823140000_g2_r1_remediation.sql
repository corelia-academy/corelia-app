-- Migration: 20260823140000_g2_r1_remediation.sql
-- Description: G2-R1 Remediation Pass
-- 1) FV-G2-02: Enforce ai_conversations <-> ai_chat_sessions composite user_id ownership invariant
-- 2) FV-G2-03: Atomic hackathon metrics snapshot patch RPC (patch_hackathon_metrics_snapshot)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) FV-G2-02: ai_conversations <-> ai_chat_sessions Ownership Invariant
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure ai_chat_sessions has a unique constraint on (id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_chat_sessions_id_user_id_unique'
  ) THEN
    ALTER TABLE public.ai_chat_sessions
      ADD CONSTRAINT ai_chat_sessions_id_user_id_unique UNIQUE (id, user_id);
  END IF;
END $$;

-- Drop single-column FK on session_id and add composite FK (session_id, user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_conversations_session_id_fkey'
  ) THEN
    ALTER TABLE public.ai_conversations
      DROP CONSTRAINT ai_conversations_session_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_conversations_session_user_fkey'
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_session_user_fkey
      FOREIGN KEY (session_id, user_id)
      REFERENCES public.ai_chat_sessions (id, user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Strengthen RLS policy on ai_conversations
DROP POLICY IF EXISTS own_conversations ON public.ai_conversations;
CREATE POLICY own_conversations
  ON public.ai_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.ai_chat_sessions s
        WHERE s.id = session_id
          AND s.user_id = auth.uid()
      )
    )
  );

-- Update sync_ai_chat_session_message_count trigger function to guard ownership
CREATE OR REPLACE FUNCTION public.sync_ai_chat_session_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_session_id uuid := NULL;
  v_new_session_id uuid := NULL;
  v_old_user_id uuid := NULL;
  v_new_user_id uuid := NULL;
  v_old_completed boolean := false;
  v_new_completed boolean := false;
  v_last_at timestamptz := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_session_id := OLD.session_id;
    v_old_user_id := OLD.user_id;
    v_old_completed := (OLD.status = 'completed');
  ELSIF TG_OP = 'INSERT' THEN
    v_new_session_id := NEW.session_id;
    v_new_user_id := NEW.user_id;
    v_new_completed := (NEW.status = 'completed');
    v_last_at := NEW.created_at;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_session_id := OLD.session_id;
    v_old_user_id := OLD.user_id;
    v_old_completed := (OLD.status = 'completed');
    v_new_session_id := NEW.session_id;
    v_new_user_id := NEW.user_id;
    v_new_completed := (NEW.status = 'completed');
    v_last_at := NEW.created_at;
  END IF;

  -- If session changed on UPDATE
  IF TG_OP = 'UPDATE' AND v_old_session_id IS DISTINCT FROM v_new_session_id THEN
    IF v_old_session_id IS NOT NULL AND v_old_completed THEN
      UPDATE public.ai_chat_sessions
      SET
        message_count = GREATEST(0, message_count - 1),
        updated_at = now()
      WHERE id = v_old_session_id
        AND user_id = v_old_user_id;
    END IF;

    IF v_new_session_id IS NOT NULL AND v_new_completed THEN
      UPDATE public.ai_chat_sessions
      SET
        message_count = message_count + 1,
        last_message_at = COALESCE(v_last_at, last_message_at),
        updated_at = now()
      WHERE id = v_new_session_id
        AND user_id = v_new_user_id;
    END IF;

    RETURN NEW;
  END IF;

  -- Same session or INSERT / DELETE
  IF TG_OP = 'INSERT' AND v_new_session_id IS NOT NULL AND v_new_completed THEN
    UPDATE public.ai_chat_sessions
    SET
      message_count = message_count + 1,
      last_message_at = COALESCE(v_last_at, last_message_at),
      updated_at = now()
    WHERE id = v_new_session_id
      AND user_id = v_new_user_id;
  ELSIF TG_OP = 'DELETE' AND v_old_session_id IS NOT NULL AND v_old_completed THEN
    UPDATE public.ai_chat_sessions
    SET
      message_count = GREATEST(0, message_count - 1),
      updated_at = now()
    WHERE id = v_old_session_id
      AND user_id = v_old_user_id;
  ELSIF TG_OP = 'UPDATE' AND v_new_session_id IS NOT NULL THEN
    IF NOT v_old_completed AND v_new_completed THEN
      UPDATE public.ai_chat_sessions
      SET
        message_count = message_count + 1,
        last_message_at = COALESCE(v_last_at, last_message_at),
        updated_at = now()
      WHERE id = v_new_session_id
        AND user_id = v_new_user_id;
    ELSIF v_old_completed AND NOT v_new_completed THEN
      UPDATE public.ai_chat_sessions
      SET
        message_count = GREATEST(0, message_count - 1),
        updated_at = now()
      WHERE id = v_new_session_id
        AND user_id = v_new_user_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) FV-G2-03: Atomic Hackathon Metrics Snapshot Patch RPC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.patch_hackathon_metrics_snapshot(
  p_hackathon_id text,
  p_metrics_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_created_by text;
  v_has_access boolean := false;
  v_new_doc jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized:authentication_required';
  END IF;

  -- 1) Staff access check
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
  IF v_role IN ('admin', 'support_staff') THEN
    v_has_access := true;
  END IF;

  -- 2) Creator or invited manager/judge/reviewer check
  IF NOT v_has_access THEN
    SELECT (document->>'created_by') INTO v_created_by FROM public.hackathons WHERE id = p_hackathon_id;
    IF v_created_by = v_uid::text THEN
      v_has_access := true;
    ELSIF public.has_hackathon_invite_role(p_hackathon_id, ARRAY['judge', 'co_organizer', 'reviewer']) THEN
      v_has_access := true;
    END IF;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'unauthorized:insufficient_permissions';
  END IF;

  -- 3) Atomic in-place JSONB patch on metrics_snapshot only (avoids lost updates on other document keys)
  UPDATE public.hackathons
  SET
    document = jsonb_set(
      COALESCE(document, '{}'::jsonb),
      '{metrics_snapshot}',
      COALESCE(p_metrics_snapshot, '{}'::jsonb),
      true
    ),
    updated_at = now()
  WHERE id = p_hackathon_id
  RETURNING document INTO v_new_doc;

  IF v_new_doc IS NULL THEN
    RAISE EXCEPTION 'not_found:hackathon';
  END IF;

  RETURN v_new_doc->'metrics_snapshot';
END;
$$;

REVOKE ALL ON FUNCTION public.patch_hackathon_metrics_snapshot(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_hackathon_metrics_snapshot(text, jsonb) TO authenticated;
