-- R4: reconcile canonical objects that were skipped or drifted on Staging.
-- The staging-only ensure_rls event trigger is intentionally retained as a
-- documented environment security control; it is not application semantics.

CREATE OR REPLACE FUNCTION public.guard_ai_chat_session_message_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    NEW.message_count := (
      SELECT count(*)::int
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

-- Multi-session history is canonical (20260523123519). A later migration
-- accidentally recreated the old one-session-per-course index. Live Staging
-- contains valid historical multi-session groups, so remove the legacy index
-- rather than deleting or merging user history.
DROP INDEX IF EXISTS public.ai_chat_sessions_course_unique;

-- public_profiles did not yet exist when the historical conditional migration
-- ran on a clean database. These indexes are required by public search.
CREATE INDEX IF NOT EXISTS public_profiles_username_trgm_idx
  ON public.public_profiles USING gin (username extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS public_profiles_ocid_trgm_idx
  ON public.public_profiles USING gin (ocid extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS public_profiles_full_name_trgm_idx
  ON public.public_profiles USING gin (full_name extensions.gin_trgm_ops);
