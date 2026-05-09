-- Phase 2 (contests): allow invitees to view/respond to invites safely.
-- Notes:
-- - Invites are stored as jsonb in `contest_access_invites.document`.
-- - We allow invitees to UPDATE their own invite row, but enforce (via trigger)
--   that they can only change `status` and `responded_at`.
-- - Creator / staff retains full control for bulk ops & revocations.
--
-- This migration assumes the `private` schema exists (created in 20260506071954).

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Helpers: current email + invite-role check (used in RLS)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(nullif(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.current_email();
$$;

GRANT EXECUTE ON FUNCTION private.current_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_email() TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.has_contest_invite_role(
  p_contest_id text,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contest_access_invites i
    WHERE i.contest_id = p_contest_id
      AND (i.document->>'email') = private.current_email()
      AND (i.document->>'status') = 'accepted'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(i.document->'roles', '[]'::jsonb)) r(role)
        WHERE r.role = ANY(p_roles)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_contest_invite_role(
  p_contest_id text,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_contest_invite_role(p_contest_id, p_roles);
$$;

GRANT EXECUTE ON FUNCTION private.has_contest_invite_role(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_contest_invite_role(text, text[]) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: invitee can only update status/responded_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.restrict_contest_invite_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := public.is_admin_or_support();
  is_creator boolean := EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id = OLD.contest_id
      AND (c.document->>'created_by') = ((SELECT auth.uid())::text)
  );
  is_invitee boolean := (OLD.document->>'email') = private.current_email();
  old_stripped jsonb;
  new_stripped jsonb;
  old_status text := COALESCE(OLD.document->>'status', '');
  new_status text := COALESCE(NEW.document->>'status', '');
BEGIN
  -- Only enforce restrictions for non-staff/non-creator invitees.
  IF is_staff OR is_creator OR NOT is_invitee THEN
    RETURN NEW;
  END IF;

  old_stripped := COALESCE(OLD.document, '{}'::jsonb) - 'status' - 'responded_at';
  new_stripped := COALESCE(NEW.document, '{}'::jsonb) - 'status' - 'responded_at';

  IF old_stripped <> new_stripped THEN
    RAISE EXCEPTION 'Invitees can only update status/responded_at';
  END IF;

  IF old_status <> 'pending' THEN
    RAISE EXCEPTION 'Invite already responded';
  END IF;

  IF new_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid invite response status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_contest_invite_self_update ON public.contest_access_invites;
CREATE TRIGGER trg_restrict_contest_invite_self_update
  BEFORE UPDATE ON public.contest_access_invites
  FOR EACH ROW
  EXECUTE FUNCTION private.restrict_contest_invite_self_update();

-- -----------------------------------------------------------------------------
-- RLS: contest_access_invites
-- -----------------------------------------------------------------------------

ALTER TABLE public.contest_access_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_invites_staff_or_creator ON public.contest_access_invites;

-- Creator/staff full access (bulk invite/revoke/etc)
CREATE POLICY contest_invites_manage_staff_or_creator
  ON public.contest_access_invites FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

-- Invitee can see their invite
CREATE POLICY contest_invites_select_self_by_email
  ON public.contest_access_invites FOR SELECT
  TO authenticated
  USING (
    (document->>'email') = public.current_email()
  );

-- Invitee can respond to their invite (restricted by trigger)
CREATE POLICY contest_invites_update_self_response_only
  ON public.contest_access_invites FOR UPDATE
  TO authenticated
  USING (
    (document->>'email') = public.current_email()
  )
  WITH CHECK (
    (document->>'email') = public.current_email()
  );

