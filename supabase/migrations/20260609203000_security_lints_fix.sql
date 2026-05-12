-- Fix Supabase database lints:
-- - Move pg_trgm out of public schema
-- - Revoke anon execution on SECURITY DEFINER RPCs

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Extensions: move pg_trgm to extensions schema (recommended)
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm'
  ) THEN
    -- If already installed, move it to extensions schema.
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  ELSE
    -- If not installed yet, install directly into extensions schema.
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) RPC hardening: ensure anon cannot execute SECURITY DEFINER functions
-- -----------------------------------------------------------------------------

-- Project collaboration invites
REVOKE ALL ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_project_collaboration_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.decline_project_collaboration_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_project_collaboration_invite_by_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.decline_project_collaboration_invite_by_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_project_collaboration_invite(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.remove_project_collaborator(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.list_invitable_hackathon_users(uuid, text, integer) FROM anon;

-- Keep intended access for signed-in users (idempotent)
GRANT EXECUTE ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_collaboration_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_project_collaboration_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_collaboration_invite_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_project_collaboration_invite_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_project_collaboration_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_invitable_hackathon_users(uuid, text, integer) TO authenticated;

COMMIT;

