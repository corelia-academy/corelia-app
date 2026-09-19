-- Enforce hackathon taxonomy contract at DB boundary
-- Invariant: Hackathons in 'published' or 'running' status must have at least one active sector and one active tech stack.
-- Draft hackathons may omit taxonomy to allow progressive authoring.

BEGIN;

CREATE OR REPLACE FUNCTION private.validate_hackathon_taxonomy(
  p_status text,
  p_document jsonb,
  p_raise_exception boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_sectors jsonb;
  v_tech_stacks jsonb;
  v_item jsonb;
  v_active_sectors integer := 0;
  v_active_tech integer := 0;
BEGIN
  -- Draft or other non-public statuses can omit taxonomy to allow progressive drafting.
  IF p_status NOT IN ('published', 'running') THEN
    RETURN true;
  END IF;

  IF p_document IS NULL OR jsonb_typeof(p_document) <> 'object' THEN
    IF p_raise_exception THEN
      RAISE EXCEPTION 'invalid_input:hackathon_document_required';
    END IF;
    RETURN false;
  END IF;

  v_sectors := p_document->'sectors';
  v_tech_stacks := p_document->'tech_stacks';

  IF v_sectors IS NULL OR jsonb_typeof(v_sectors) <> 'array' THEN
    IF p_raise_exception THEN
      RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_required';
    END IF;
    RETURN false;
  END IF;

  IF v_tech_stacks IS NULL OR jsonb_typeof(v_tech_stacks) <> 'array' THEN
    IF p_raise_exception THEN
      RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_required';
    END IF;
    RETURN false;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(v_sectors)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF btrim(v_item->>'id') = '' OR btrim(v_item->>'name') = '' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF v_item ? 'active' AND jsonb_typeof(v_item->'active') <> 'boolean' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF v_item ? 'sort_order' AND jsonb_typeof(v_item->'sort_order') <> 'number' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF NOT (v_item ? 'active') OR (v_item->'active')::boolean = true THEN
      v_active_sectors := v_active_sectors + 1;
    END IF;
  END LOOP;

  FOR v_item IN SELECT jsonb_array_elements(v_tech_stacks)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF btrim(v_item->>'id') = '' OR btrim(v_item->>'name') = '' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF v_item ? 'active' AND jsonb_typeof(v_item->'active') <> 'boolean' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF v_item ? 'sort_order' AND jsonb_typeof(v_item->'sort_order') <> 'number' THEN
      IF p_raise_exception THEN RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid'; END IF;
      RETURN false;
    END IF;
    IF NOT (v_item ? 'active') OR (v_item->'active')::boolean = true THEN
      v_active_tech := v_active_tech + 1;
    END IF;
  END LOOP;

  IF v_active_sectors = 0 OR v_active_tech = 0 THEN
    IF p_raise_exception THEN
      RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_required';
    END IF;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy(text, jsonb, boolean) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy(text, jsonb, boolean) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy(text, jsonb, boolean) FROM authenticated';
  END IF;
END $$;

-- Audit existing rows before arming trigger: abort migration if any published/running rows violate contract.
DO $$
DECLARE
  v_invalid_count integer;
BEGIN
  IF to_regclass('public.hackathons') IS NOT NULL THEN
    SELECT count(*) INTO v_invalid_count
    FROM public.hackathons h
    WHERE h.status IN ('published', 'running')
      AND NOT private.validate_hackathon_taxonomy(h.status, h.document, false);

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'migration_aborted: % existing published/running hackathons violate taxonomy contract', v_invalid_count;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_hackathon_taxonomy_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.validate_hackathon_taxonomy(NEW.status, NEW.document, true);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy_trigger() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy_trigger() FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.validate_hackathon_taxonomy_trigger() FROM authenticated';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_validate_hackathon_taxonomy ON public.hackathons;
CREATE TRIGGER trg_validate_hackathon_taxonomy
  BEFORE INSERT OR UPDATE OF status, document ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION private.validate_hackathon_taxonomy_trigger();

COMMIT;
