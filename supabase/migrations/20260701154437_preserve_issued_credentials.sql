-- Preserve issued OCA/OCB credentials when their source entities are deleted.
-- Issuances are historical records: parent/template deletion may orphan them,
-- but must never delete them transitively.

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- 1) Persist the minimum display metadata needed after source rows disappear.
-- -----------------------------------------------------------------------------
ALTER TABLE public.credential_issuances
  ADD COLUMN IF NOT EXISTS display_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.credential_issuances
  DROP CONSTRAINT IF EXISTS credential_issuances_display_snapshot_object;

ALTER TABLE public.credential_issuances
  ADD CONSTRAINT credential_issuances_display_snapshot_object
  CHECK (jsonb_typeof(display_snapshot) = 'object');

-- -----------------------------------------------------------------------------
-- 2) Restore scope invariants while allowing a deleted parent to leave an
--    orphaned template. Hackathon templates must still have a role.
-- -----------------------------------------------------------------------------
ALTER TABLE public.credential_templates
  DROP CONSTRAINT IF EXISTS credential_templates_scope_consistency;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_scope_consistency CHECK (
    (scope_type = 'course' AND hackathon_id IS NULL)
    OR (
      scope_type = 'hackathon'
      AND course_id IS NULL
      AND hackathon_role IS NOT NULL
    )
    OR (
      scope_type = 'activity_milestone'
      AND course_id IS NULL
      AND hackathon_id IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Normalize foreign keys by table + column rather than assuming historical
--    constraint names. This is safe across environments with constraint drift.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT DISTINCT
      ns.nspname AS schema_name,
      tbl.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class tbl
      ON tbl.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = tbl.relnamespace
    JOIN pg_attribute attr
      ON attr.attrelid = con.conrelid
     AND attr.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND cardinality(con.conkey) = 1
      AND ns.nspname = 'public'
      AND (
        (tbl.relname = 'credential_templates' AND attr.attname IN ('course_id', 'hackathon_id'))
        OR (
          tbl.relname = 'credential_issuances'
          AND attr.attname IN ('template_id', 'course_id', 'hackathon_id')
        )
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name
    );
  END LOOP;
END
$$;

ALTER TABLE public.credential_issuances
  ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE SET NULL;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_hackathon_id_fkey
  FOREIGN KEY (hackathon_id)
  REFERENCES public.hackathons(id)
  ON DELETE SET NULL;

ALTER TABLE public.credential_issuances
  ADD CONSTRAINT credential_issuances_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES public.credential_templates(id)
  ON DELETE SET NULL;

ALTER TABLE public.credential_issuances
  ADD CONSTRAINT credential_issuances_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE SET NULL;

ALTER TABLE public.credential_issuances
  ADD CONSTRAINT credential_issuances_hackathon_id_fkey
  FOREIGN KEY (hackathon_id)
  REFERENCES public.hackathons(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4) Build immutable display metadata at issuance creation time. Dedicated
--    columns remain the source of truth for minted_at and Open Campus IDs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.build_credential_display_snapshot(
  p_template_id uuid,
  p_course_id text,
  p_hackathon_id text,
  p_issued_at timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'template_id', template_row.id,
      'credential_title', template_row.name,
      'credential_description', template_row.description,
      'image_url', template_row.image_url,
      -- thumbnail_url is introduced by a later migration in fresh installs.
      -- Reading through to_jsonb keeps this migration valid both before and
      -- after that optional display column exists.
      'thumbnail_url', to_jsonb(template_row)->>'thumbnail_url',
      'scope_type', template_row.scope_type,
      'achievement_type', template_row.achievement_type,
      'course_title', CASE
        WHEN template_row.scope_type = 'course' THEN
          COALESCE(
            NULLIF(btrim(course_row.data->>'title'), ''),
            NULLIF(btrim(template_row.name), '')
          )
        ELSE NULL
      END,
      'instructor_name', CASE
        WHEN template_row.scope_type = 'course' THEN
          COALESCE(
            NULLIF(btrim(course_row.data->>'instructor_name'), ''),
            NULLIF(btrim(instructor_profile.full_name), ''),
            NULLIF(btrim(instructor_profile.username), '')
          )
        ELSE NULL
      END,
      'hackathon_title', CASE
        WHEN template_row.scope_type = 'hackathon' THEN
          COALESCE(
            NULLIF(btrim(hackathon_row.document->>'title'), ''),
            NULLIF(btrim(template_row.name), '')
          )
        ELSE NULL
      END,
      'hackathon_role', template_row.hackathon_role,
      'collection_symbol', template_row.collection_symbol,
      'issued_at', p_issued_at,
      'metadata', COALESCE(template_row.custom_metadata, '{}'::jsonb)
    )
  )
  FROM public.credential_templates AS template_row
  LEFT JOIN public.courses AS course_row
    ON course_row.id = COALESCE(p_course_id, template_row.course_id)
  LEFT JOIN public.profiles AS instructor_profile
    ON instructor_profile.id = course_row.instructor_id
  LEFT JOIN public.hackathons AS hackathon_row
    ON hackathon_row.id = COALESCE(p_hackathon_id, template_row.hackathon_id)
  WHERE template_row.id = p_template_id;
$$;

CREATE OR REPLACE FUNCTION private.capture_credential_issuance_display_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.display_snapshot IS NULL OR NEW.display_snapshot = '{}'::jsonb THEN
    NEW.display_snapshot := COALESCE(
      private.build_credential_display_snapshot(
        NEW.template_id,
        NEW.course_id,
        NEW.hackathon_id,
        NEW.created_at
      ),
      jsonb_strip_nulls(jsonb_build_object('issued_at', NEW.created_at))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credential_issuances_capture_display_snapshot
  ON public.credential_issuances;

CREATE TRIGGER trg_credential_issuances_capture_display_snapshot
  BEFORE INSERT ON public.credential_issuances
  FOR EACH ROW
  EXECUTE FUNCTION private.capture_credential_issuance_display_snapshot();

-- Backfill every surviving historical issuance. For already-orphaned templates,
-- template metadata is still captured and used as the source-title fallback.
UPDATE public.credential_issuances AS issuance
SET display_snapshot = COALESCE(
  private.build_credential_display_snapshot(
    issuance.template_id,
    issuance.course_id,
    issuance.hackathon_id,
    issuance.created_at
  ),
  jsonb_strip_nulls(jsonb_build_object('issued_at', issuance.created_at))
)
WHERE issuance.display_snapshot = '{}'::jsonb;

REVOKE ALL ON FUNCTION private.build_credential_display_snapshot(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.capture_credential_issuance_display_snapshot()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.credential_issuances.display_snapshot IS
  'Immutable display metadata captured when a credential issuance is created.';
