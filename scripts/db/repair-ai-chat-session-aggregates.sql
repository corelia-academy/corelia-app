-- ============================================================================
-- REPAIR TOOL: AI CHAT SESSION AGGREGATES RECOVERY SCRIPT
-- Scope: Incident recovery tool for restoring derived aggregate fields on
--        public.ai_chat_sessions from canonical public.ai_conversations.
-- Invariants:
--   - Scoped strictly to derived aggregate: message_count (and best-effort last_message_at)
--   - Recomputes deterministically from completed conversations
--   - Idempotent and transaction bounded
--   - Non-destructive (no deletes, no customer prompt/response mutation)
-- Manual execution only: DO NOT run automatically in production deployment workflows.
-- ============================================================================

BEGIN;

-- 1. DRY-RUN INSPECTION: Identify all sessions with mismatched aggregates
DO $$
DECLARE
  v_mismatch_count int;
BEGIN
  SELECT COUNT(*)
  INTO v_mismatch_count
  FROM (
    SELECT s.id
    FROM public.ai_chat_sessions s
    LEFT JOIN public.ai_conversations c ON c.session_id = s.id
    GROUP BY s.id, s.message_count
    HAVING s.message_count <> COUNT(c.id) FILTER (WHERE c.status = 'completed')
  ) sub;

  RAISE NOTICE 'Pre-repair inspection: found % session(s) with mismatched message_count', v_mismatch_count;
END;
$$;

-- 2. ATOMIC RECONCILIATION: Update only sessions with mismatched message_count
WITH canonical_session_aggregates AS (
  SELECT
    s.id AS session_id,
    COUNT(c.id) FILTER (WHERE c.status = 'completed')::int AS canonical_message_count,
    MAX(c.created_at) FILTER (WHERE c.status = 'completed') AS canonical_last_message_at
  FROM public.ai_chat_sessions s
  LEFT JOIN public.ai_conversations c ON c.session_id = s.id
  GROUP BY s.id
)
UPDATE public.ai_chat_sessions AS s
SET
  message_count = csa.canonical_message_count,
  last_message_at = COALESCE(csa.canonical_last_message_at, s.last_message_at),
  updated_at = now()
FROM canonical_session_aggregates csa
WHERE s.id = csa.session_id
  AND s.message_count <> csa.canonical_message_count;

-- 3. POST-REPAIR VERIFICATION: Confirm 0 mismatches remain
DO $$
DECLARE
  v_remaining_mismatches int;
BEGIN
  SELECT COUNT(*)
  INTO v_remaining_mismatches
  FROM (
    SELECT s.id
    FROM public.ai_chat_sessions s
    LEFT JOIN public.ai_conversations c ON c.session_id = s.id
    GROUP BY s.id, s.message_count
    HAVING s.message_count <> COUNT(c.id) FILTER (WHERE c.status = 'completed')
  ) sub;

  IF v_remaining_mismatches > 0 THEN
    RAISE EXCEPTION 'Post-repair verification failed: % mismatch(es) remain', v_remaining_mismatches;
  END IF;

  RAISE NOTICE 'Post-repair verification passed: 0 mismatches remaining across all ai_chat_sessions';
END;
$$;

COMMIT;
