-- G2 Canonical State & Data Integrity Migration
-- Forward-only, data-preserving migration implementing:
-- G2-A: Profiles streak_days deprecation comment
-- G2-C: Concurrency-safe AI session message_count synchronization trigger
-- G2-D: Voucher archival columns and foreign key RESTRICT constraints
-- G2-F: AI model pricing deprecation classification comment

-- 1. G2-D: Add archival columns to ai_voucher_batches
ALTER TABLE public.ai_voucher_batches
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- 2. G2-D: Strengthen Foreign Keys to ON DELETE RESTRICT (preserve historical redemption evidence)
-- ai_vouchers -> ai_voucher_batches
ALTER TABLE public.ai_vouchers
  DROP CONSTRAINT IF EXISTS ai_vouchers_batch_id_fkey;

ALTER TABLE public.ai_vouchers
  ADD CONSTRAINT ai_vouchers_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.ai_voucher_batches (id) ON DELETE RESTRICT;

-- ai_voucher_redemptions -> ai_vouchers
ALTER TABLE public.ai_voucher_redemptions
  DROP CONSTRAINT IF EXISTS ai_voucher_redemptions_voucher_id_fkey;

ALTER TABLE public.ai_voucher_redemptions
  ADD CONSTRAINT ai_voucher_redemptions_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.ai_vouchers (id) ON DELETE RESTRICT;

-- 3. G2-C: AI chat session message_count synchronization trigger
CREATE OR REPLACE FUNCTION public.sync_ai_chat_session_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
  v_delta int := 0;
  v_last_at timestamptz := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.session_id IS NOT NULL AND NEW.status = 'completed' THEN
      v_session_id := NEW.session_id;
      v_delta := 1;
      v_last_at := NEW.created_at;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.session_id IS DISTINCT FROM NEW.session_id THEN
      IF OLD.session_id IS NOT NULL AND OLD.status = 'completed' THEN
        UPDATE public.ai_chat_sessions
        SET message_count = GREATEST(0, message_count - 1),
            updated_at = now()
        WHERE id = OLD.session_id;
      END IF;
      IF NEW.session_id IS NOT NULL AND NEW.status = 'completed' THEN
        v_session_id := NEW.session_id;
        v_delta := 1;
        v_last_at := NEW.created_at;
      END IF;
    ELSE
      v_session_id := NEW.session_id;
      IF v_session_id IS NOT NULL THEN
        IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
          v_delta := 1;
          v_last_at := NEW.created_at;
        ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
          v_delta := -1;
        END IF;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.session_id IS NOT NULL AND OLD.status = 'completed' THEN
      v_session_id := OLD.session_id;
      v_delta := -1;
    END IF;
  END IF;

  IF v_session_id IS NOT NULL AND v_delta <> 0 THEN
    UPDATE public.ai_chat_sessions
    SET message_count = GREATEST(0, message_count + v_delta),
        last_message_at = COALESCE(v_last_at, last_message_at),
        updated_at = now()
    WHERE id = v_session_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ai_chat_session_message_count ON public.ai_conversations;
CREATE TRIGGER trg_sync_ai_chat_session_message_count
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ai_chat_session_message_count();

CREATE OR REPLACE FUNCTION public.guard_ai_chat_session_message_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If message_count is modified directly on ai_chat_sessions from external/legacy code (trigger depth = 1),
  -- normalize it to the true canonical completed conversation count to prevent stale overwrites.
  IF pg_trigger_depth() = 1 AND NEW.message_count IS DISTINCT FROM OLD.message_count THEN
    NEW.message_count := (
      SELECT COUNT(*)::int
      FROM public.ai_conversations c
      WHERE c.session_id = NEW.id
        AND c.status = 'completed'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ai_chat_session_message_count ON public.ai_chat_sessions;
CREATE TRIGGER trg_guard_ai_chat_session_message_count
  BEFORE UPDATE OF message_count ON public.ai_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ai_chat_session_message_count();

-- Backfill existing session message counts deterministically from completed conversations
UPDATE public.ai_chat_sessions AS s
SET message_count = COALESCE((
  SELECT COUNT(*)::int
  FROM public.ai_conversations c
  WHERE c.session_id = s.id
    AND c.status = 'completed'
), 0);

-- 4. G2-A & G2-F: Architectural classification comments
COMMENT ON COLUMN public.profiles.streak_days IS 'DEPRECATED: Canonical streak state is in public.user_daily_streaks';
COMMENT ON TABLE public.ai_model_pricing IS 'DEPRECATION_CANDIDATE_PENDING_REVIEW: Runtime pricing canonical source is application code';
