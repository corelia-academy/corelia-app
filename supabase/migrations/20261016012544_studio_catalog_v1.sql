-- Corelia Studio catalog schema v1 (Step 1 "Phạm vi Catalog" of the Studio flow).
--
-- Replaces the unmerged `studio_course_catalog` draft (single-valued `entry`,
-- 4 statuses, 6 step keys). Nothing named `studio_*` exists in the migration
-- chain, so these are plain CREATE TABLEs.
--
-- Model
--   studio_catalog_scopes  one scope per group kind: audience, Corelia direction,
--                          locale, research period (default 90 days)
--   studio_paths           named path inside a kind (Rust, Frontend, Solana, ...)
--   studio_courses         catalog entry; title is unique ignoring case and
--                          surrounding spaces. Two independent states:
--                            research_status  evidence for ranking (idea,
--                                             needs_more_sources, evidence_ok)
--                            status           production state in the catalog
--                          The rule "only evidence_ok enters the queue" is applied
--                          by the server at the transition (E4/E5), not by a CHECK:
--                          a published course may be re-researched later.
--   studio_course_paths    many-to-many course <-> path, with separate order
--                          columns per path (learning order, display order);
--                          production priority is global: studio_courses.priority
--   studio_runs            one generation run of a course; the client may supply
--                          the id (a repeated insert of the same run fails), at most
--                          one running run per course, reason required when a run
--                          ends as a draft (draft_failed)
--   studio_run_steps       state of the 9 steps inside a run, with repair count
--
-- Authorization (admin only, read and write)
--   Studio is an admin tool and the publishable key ships in the browser bundle, so
--   a public SELECT would expose unannounced catalog/ranking/plans to anyone.
--   anon has no grant at all. SELECT/INSERT/UPDATE/DELETE are allowed to
--   `authenticated` only when studio_can_write(), i.e. the caller's row in
--   public.profiles has role = 'admin'. support_staff, instructor, student read
--   and write nothing (SELECT returns 0 rows). The role is read from
--   public.profiles via auth.uid(), never from JWT/user_metadata claims.
--   Deliberately not built on is_admin_or_support(), which also admits support_staff.
--   To open public read of finalized data later, change only the SELECT policy
--   (and re-GRANT SELECT to anon); the write policies and helper stay as they are.
--   Gating "Bắt đầu tạo" (costly model runs) belongs to the E5 server function,
--   not to RLS here.

-- -----------------------------------------------------------------------------
-- 1) Admin gate helper, used for read and write (same pattern as is_admin_or_support)
--    SECURITY DEFINER implementation in `private` (reads profiles without RLS
--    recursion), SECURITY INVOKER wrapper in `public` for policies.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.studio_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.studio_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.studio_can_write();
$$;

REVOKE ALL ON FUNCTION private.studio_can_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.studio_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.studio_can_write() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_can_write() TO anon, authenticated;

COMMENT ON FUNCTION private.studio_can_write() IS
  'Studio admin gate (read and write): profiles.role = admin for auth.uid(). Not is_admin_or_support (that admits support_staff).';

-- -----------------------------------------------------------------------------
-- 2) Tables
-- -----------------------------------------------------------------------------

CREATE TABLE public.studio_catalog_scopes (
  group_kind text PRIMARY KEY
    CHECK (group_kind IN ('skill', 'role', 'ecosystem')),
  audience text NOT NULL CHECK (length(btrim(audience)) > 0),
  corelia_direction text NOT NULL CHECK (length(btrim(corelia_direction)) > 0),
  locale text NOT NULL DEFAULT 'vi'
    CHECK (locale IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja')),
  research_period_days integer NOT NULL DEFAULT 90
    CHECK (research_period_days BETWEEN 1 AND 3650),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.studio_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_kind text NOT NULL
    CHECK (group_kind IN ('skill', 'role', 'ecosystem')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_kind, slug)
);

CREATE TABLE public.studio_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  level text CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'queued', 'generating', 'published', 'needs_update', 'not_passed')),
  research_status text NOT NULL DEFAULT 'idea'
    CHECK (research_status IN ('idea', 'needs_more_sources', 'evidence_ok')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One catalog entry per course name: Studio matches courses by title (idea form, preset import),
-- so duplicates must be rejected by the database, not only by a client-side check.
CREATE UNIQUE INDEX studio_courses_title_key
  ON public.studio_courses (lower(btrim(title)));

CREATE TABLE public.studio_course_paths (
  course_id uuid NOT NULL REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  path_id uuid NOT NULL REFERENCES public.studio_paths (id) ON DELETE CASCADE,
  learning_order integer NOT NULL DEFAULT 0 CHECK (learning_order >= 0),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, path_id)
);

CREATE INDEX studio_course_paths_path_learning_idx
  ON public.studio_course_paths (path_id, learning_order);

CREATE TABLE public.studio_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'published', 'draft_failed')),
  hold_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_runs_finished_matches_status
    CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT studio_runs_hold_reason_iff_draft
    CHECK ((status = 'draft_failed') = (hold_reason IS NOT NULL AND length(btrim(hold_reason)) > 0))
);

CREATE UNIQUE INDEX studio_runs_one_running_per_course
  ON public.studio_runs (course_id) WHERE status = 'running';
CREATE INDEX studio_runs_course_started_idx
  ON public.studio_runs (course_id, started_at DESC);

CREATE TABLE public.studio_run_steps (
  run_id uuid NOT NULL REFERENCES public.studio_runs (id) ON DELETE CASCADE,
  step_key text NOT NULL
    CHECK (step_key IN (
      'brief',
      'research',
      'curriculum',
      'curriculum_review',
      'lessons',
      'lesson_review',
      'structure_check',
      'journey_test',
      'publish'
    )),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'active', 'done', 'failed')),
  repair_count integer NOT NULL DEFAULT 0 CHECK (repair_count >= 0),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, step_key)
);

-- updated_at maintenance (existing helper)
CREATE TRIGGER trg_studio_catalog_scopes_touch_updated_at
  BEFORE UPDATE ON public.studio_catalog_scopes
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER trg_studio_paths_touch_updated_at
  BEFORE UPDATE ON public.studio_paths
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER trg_studio_courses_touch_updated_at
  BEFORE UPDATE ON public.studio_courses
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER trg_studio_course_paths_touch_updated_at
  BEFORE UPDATE ON public.studio_course_paths
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER trg_studio_runs_touch_updated_at
  BEFORE UPDATE ON public.studio_runs
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER trg_studio_run_steps_touch_updated_at
  BEFORE UPDATE ON public.studio_run_steps
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3) RLS: read and write gated by studio_can_write() (admin only)
-- -----------------------------------------------------------------------------

ALTER TABLE public.studio_catalog_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_course_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_run_steps ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studio_catalog_scopes',
    'studio_paths',
    'studio_courses',
    'studio_course_paths',
    'studio_runs',
    'studio_run_steps'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.studio_can_write()))',
      t || '_admin_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.studio_can_write()))',
      t || '_write_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.studio_can_write())) WITH CHECK ((SELECT public.studio_can_write()))',
      t || '_write_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.studio_can_write()))',
      t || '_write_delete', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;
