BEGIN;

-- Hackathon MVP: public counters and canonical project metadata.
ALTER TABLE public.hackathons
  ADD COLUMN IF NOT EXISTS participants_count integer NOT NULL DEFAULT 0
  CHECK (participants_count >= 0);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS hackathon_track_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hackathon_sector_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hackathon_tech_stack_ids text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.hackathon_submissions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

UPDATE public.projects
SET slug = concat(
  COALESCE(
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), ''),
    'project'
  ),
  '-',
  substring(id::text, 1, 8)
)
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE public.projects ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_source_type_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_source_type_check
  CHECK (source_type IN ('standalone', 'contest', 'hackathon', 'course'));

CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_lower_unique
  ON public.projects (lower(slug));
CREATE INDEX IF NOT EXISTS projects_hackathon_track_ids_gin
  ON public.projects USING gin (hackathon_track_ids);
CREATE INDEX IF NOT EXISTS projects_hackathon_sector_ids_gin
  ON public.projects USING gin (hackathon_sector_ids);
CREATE INDEX IF NOT EXISTS projects_hackathon_tech_stack_ids_gin
  ON public.projects USING gin (hackathon_tech_stack_ids);
CREATE UNIQUE INDEX IF NOT EXISTS hackathon_submissions_project_unique
  ON public.hackathon_submissions (project_id)
  WHERE project_id IS NOT NULL;

UPDATE public.hackathon_submissions hs
SET project_id = p.id
FROM public.projects p
WHERE hs.project_id IS NULL
  AND p.source_submission_id = hs.id
  AND p.source_type IN ('contest', 'hackathon');

CREATE TABLE public.project_slug_history (
  slug text PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_slug_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.project_slug_history TO anon, authenticated;

CREATE POLICY project_slug_history_select_visible
  ON public.project_slug_history FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id)
  );

CREATE OR REPLACE FUNCTION private.guard_project_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text := lower(btrim(NEW.slug));
BEGIN
  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' OR length(v_slug) < 3 OR length(v_slug) > 100 THEN
    RAISE EXCEPTION 'invalid_input:project_slug';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.projects p
    WHERE lower(p.slug) = v_slug AND p.id <> NEW.id
  ) OR EXISTS (
    SELECT 1 FROM public.project_slug_history h
    WHERE lower(h.slug) = v_slug
  ) THEN
    RAISE EXCEPTION 'conflict:project_slug';
  END IF;
  NEW.slug := v_slug;
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.project_slug_history(slug, project_id)
    VALUES (lower(OLD.slug), OLD.id)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_project_slug_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_project_slug_change
  BEFORE INSERT OR UPDATE OF slug ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.guard_project_slug_change();

-- Backfill the simplified document contract without inventing prize amounts.
UPDATE public.hackathons
SET document = (
  document
  - 'tagline'
  - 'description'
  - 'location'
  - 'judge_emails'
  - 'co_organizer_emails'
  - 'co_host_viewer_emails'
  - 'partner_viewer_emails'
  - 'mentor_emails'
  - 'reviewer_emails'
  - 'rubric_weights'
  - 'rounds'
  - 'judging'
  - 'published_leaderboard'
  - 'winner_announcements'
  - 'prize_pool_summary'
  - 'timeline_milestones'
  - 'resources'
  - 'prizes'
  - 'config'
)
|| jsonb_build_object(
  'short_description', COALESCE(document->>'short_description', document->>'tagline', ''),
  'description_markdown', COALESCE(document->>'description_markdown', document->>'description', ''),
  'resources_markdown', COALESCE(
    document->>'resources_markdown',
    CASE WHEN jsonb_typeof(document->'resources') = 'string' THEN document->>'resources' ELSE '' END
  ),
  'mode', COALESCE(document->>'mode', document->>'location', 'online'),
  'host', COALESCE(document->'host', '{}'::jsonb),
  'social_links', COALESCE(document->'social_links', '{}'::jsonb),
  'prize_pool', COALESCE(
    document->'prize_pool',
    jsonb_build_object(
      'amount', '',
      'currency', '',
      'description_markdown', COALESCE(document->>'prize_pool_summary', '')
    )
  ),
  'sectors', COALESCE(document->'sectors', '[]'::jsonb),
  'tech_stacks', COALESCE(document->'tech_stacks', '[]'::jsonb),
  'timeline', COALESCE(
    document->'timeline',
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', 'legacy-' || substr(md5(COALESCE(item->>'title', '') || ':' || COALESCE(item->>'at', '') || ':' || ordinal::text), 1, 12),
        'title', COALESCE(item->>'title', ''),
        'starts_at', COALESCE(item->>'at', ''),
        'ends_at', NULL,
        'description_markdown', NULL,
        'sort_order', ordinal - 1
      ) ORDER BY ordinal), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(document->'timeline_milestones', '[]'::jsonb)) WITH ORDINALITY AS legacy(item, ordinal)
    )
  ),
  'winner_awards', COALESCE(
    document->'winner_awards',
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', 'legacy-' || substr(md5(COALESCE(winner->>'submission_id', '') || ':' || ordinal::text), 1, 12),
        'project_id', submission.project_id,
        'label', COALESCE(winner->>'award_title', winner->>'title', 'Winner'),
        'sort_order', ordinal - 1
      ) ORDER BY ordinal), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(document->'winner_announcements', '[]'::jsonb)) WITH ORDINALITY AS legacy(winner, ordinal)
      JOIN public.hackathon_submissions submission ON submission.id = winner->>'submission_id'
      WHERE submission.project_id IS NOT NULL
    )
  )
);

UPDATE public.hackathon_registrations
SET document = (document - 'reviewed_at' - 'reviewed_by' - 'review_note')
  || jsonb_build_object('status', 'registered', 'updated_at', now());

UPDATE public.hackathons h
SET participants_count = counts.total
FROM (
  SELECT hackathon_id, count(*)::integer AS total
  FROM public.hackathon_registrations
  GROUP BY hackathon_id
) counts
WHERE counts.hackathon_id = h.id;

CREATE OR REPLACE FUNCTION private.sync_hackathon_participants_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hackathon_id text := COALESCE(NEW.hackathon_id, OLD.hackathon_id);
BEGIN
  UPDATE public.hackathons h
  SET participants_count = (
    SELECT count(*)::integer
    FROM public.hackathon_registrations r
    WHERE r.hackathon_id = v_hackathon_id
  )
  WHERE h.id = v_hackathon_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_hackathon_participants_count() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_hackathon_participants_count
  AFTER INSERT OR DELETE ON public.hackathon_registrations
  FOR EACH ROW EXECUTE FUNCTION private.sync_hackathon_participants_count();

CREATE OR REPLACE FUNCTION private.enforce_instant_hackathon_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_document jsonb;
  v_deadline timestamptz;
BEGIN
  SELECT h.status, h.document INTO v_status, v_document
  FROM public.hackathons h
  WHERE h.id = NEW.hackathon_id;
  IF v_status NOT IN ('published', 'running') THEN
    RAISE EXCEPTION 'forbidden:registration_closed';
  END IF;
  BEGIN
    v_deadline := NULLIF(v_document->>'registration_deadline', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_deadline := NULL;
  END;
  IF v_deadline IS NOT NULL AND clock_timestamp() > v_deadline THEN
    RAISE EXCEPTION 'forbidden:registration_deadline_passed';
  END IF;
  NEW.document := (NEW.document - 'reviewed_at' - 'reviewed_by' - 'review_note')
    || jsonb_build_object('status', 'registered', 'updated_at', clock_timestamp());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_instant_hackathon_registration() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_instant_hackathon_registration
  BEFORE INSERT ON public.hackathon_registrations
  FOR EACH ROW EXECUTE FUNCTION private.enforce_instant_hackathon_registration();

-- Registration review is no longer part of the product.
DROP TRIGGER IF EXISTS trg_hackathon_registrations_notify_review ON public.hackathon_registrations;
DROP FUNCTION IF EXISTS private.notify_hackathon_registration_review();
DROP POLICY IF EXISTS hackathon_registrations_update_staff_or_reviewer ON public.hackathon_registrations;

-- Admin/support are the only hackathon authors.
DROP POLICY IF EXISTS hackathons_write_staff ON public.hackathons;
DROP POLICY IF EXISTS hackathons_insert_instructor_corelia ON public.hackathons;
DROP POLICY IF EXISTS hackathons_update_creator_staff ON public.hackathons;
DROP POLICY IF EXISTS hackathons_delete_staff ON public.hackathons;
CREATE POLICY hackathons_insert_admin
  ON public.hackathons FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY hackathons_update_admin
  ON public.hackathons FOR UPDATE TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY hackathons_delete_admin
  ON public.hackathons FOR DELETE TO authenticated
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS hackathon_locales_insert_manage ON public.hackathon_locales;
DROP POLICY IF EXISTS hackathon_locales_update_manage ON public.hackathon_locales;
DROP POLICY IF EXISTS hackathon_locales_delete_manage ON public.hackathon_locales;
CREATE POLICY hackathon_locales_insert_admin
  ON public.hackathon_locales FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY hackathon_locales_update_admin
  ON public.hackathon_locales FOR UPDATE TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());
CREATE POLICY hackathon_locales_delete_admin
  ON public.hackathon_locales FOR DELETE TO authenticated
  USING (public.is_admin_or_support());

-- Remove legacy project mirroring; projects are canonical and submissions link to them.
DROP TRIGGER IF EXISTS trg_sync_project_from_hackathon_submission ON public.hackathon_submissions;
DROP FUNCTION IF EXISTS private.sync_project_from_hackathon_submission();
DROP FUNCTION IF EXISTS private.sync_project_from_contest_submission();

CREATE OR REPLACE FUNCTION private.enforce_contest_project_submission_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_document jsonb;
  v_deadline timestamptz;
BEGIN
  IF TG_OP <> 'UPDATE'
    OR NEW.source_type NOT IN ('contest', 'hackathon')
    OR NEW.source_id IS NULL
    OR public.is_admin_or_support()
  THEN
    RETURN NEW;
  END IF;

  SELECT h.document INTO v_document
  FROM public.hackathons h
  WHERE h.id = NEW.source_id;

  BEGIN
    v_deadline := COALESCE(
      NULLIF(v_document->>'submission_deadline', '')::timestamptz,
      NULLIF(v_document->>'ends_at', '')::timestamptz
    );
  EXCEPTION WHEN OTHERS THEN
    v_deadline := NULL;
  END;

  IF v_deadline IS NOT NULL
    AND clock_timestamp() > v_deadline
    AND (
      NEW.slug IS DISTINCT FROM OLD.slug
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.demo_url IS DISTINCT FROM OLD.demo_url
      OR NEW.repo_url IS DISTINCT FROM OLD.repo_url
      OR NEW.slide_url IS DISTINCT FROM OLD.slide_url
      OR NEW.hackathon_track_ids IS DISTINCT FROM OLD.hackathon_track_ids
      OR NEW.hackathon_sector_ids IS DISTINCT FROM OLD.hackathon_sector_ids
      OR NEW.hackathon_tech_stack_ids IS DISTINCT FROM OLD.hackathon_tech_stack_ids
    )
  THEN
    RAISE EXCEPTION 'forbidden:submission_deadline_passed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_contest_project_submission_lock ON public.projects;
CREATE TRIGGER trg_enforce_contest_project_submission_lock
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.enforce_contest_project_submission_lock();

CREATE OR REPLACE FUNCTION public.upsert_hackathon_project(
  p_hackathon_id text,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_screenshot_url text DEFAULT NULL,
  p_cover_image_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}',
  p_sector_ids text[] DEFAULT '{}',
  p_tech_stack_ids text[] DEFAULT '{}'
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_document jsonb;
  v_deadline timestamptz;
  v_submission_id text;
  v_project_id uuid;
  v_tracks text[];
  v_sectors text[];
  v_tech_stacks text[];
  v_existing_tracks text[] := '{}';
  v_existing_sectors text[] := '{}';
  v_existing_tech_stacks text[] := '{}';
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input:project_title';
  END IF;
  IF cardinality(p_track_ids) = 0 OR cardinality(p_sector_ids) = 0 OR cardinality(p_tech_stack_ids) = 0 THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy_required';
  END IF;

  SELECT h.document INTO v_document
  FROM public.hackathons h
  WHERE h.id = p_hackathon_id
    AND h.status IN ('published', 'running', 'ended');
  IF v_document IS NULL THEN
    RAISE EXCEPTION 'not_found:hackathon';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hackathon_registrations r
    WHERE r.hackathon_id = p_hackathon_id
      AND r.user_id = v_user_id
      AND r.document->>'status' IN ('registered', 'approved')
  ) THEN
    RAISE EXCEPTION 'forbidden:registration_required';
  END IF;

  BEGIN
    v_deadline := COALESCE(
      NULLIF(v_document->>'submission_deadline', '')::timestamptz,
      NULLIF(v_document->>'ends_at', '')::timestamptz
    );
  EXCEPTION WHEN OTHERS THEN
    v_deadline := NULL;
  END;
  IF v_deadline IS NOT NULL AND v_now > v_deadline THEN
    RAISE EXCEPTION 'forbidden:submission_deadline_passed';
  END IF;

  v_submission_id := p_hackathon_id || '_' || v_user_id::text;
  SELECT hs.project_id, p.hackathon_track_ids, p.hackathon_sector_ids, p.hackathon_tech_stack_ids
  INTO v_project_id, v_existing_tracks, v_existing_sectors, v_existing_tech_stacks
  FROM public.hackathon_submissions hs
  LEFT JOIN public.projects p ON p.id = hs.project_id
  WHERE hs.id = v_submission_id;

  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_tracks
  FROM jsonb_array_elements(COALESCE(v_document->'tracks', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';
  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_sectors
  FROM jsonb_array_elements(COALESCE(v_document->'sectors', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';
  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_tech_stacks
  FROM jsonb_array_elements(COALESCE(v_document->'tech_stacks', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';

  v_tracks := v_tracks || COALESCE(v_existing_tracks, '{}');
  v_sectors := v_sectors || COALESCE(v_existing_sectors, '{}');
  v_tech_stacks := v_tech_stacks || COALESCE(v_existing_tech_stacks, '{}');
  IF NOT p_track_ids <@ v_tracks OR NOT p_sector_ids <@ v_sectors OR NOT p_tech_stack_ids <@ v_tech_stacks THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy';
  END IF;

  v_project_id := COALESCE(v_project_id, p_project_id, gen_random_uuid());

  INSERT INTO public.projects (
    id, owner_id, slug, title, summary, demo_url, repo_url, slide_url,
    screenshot_url, cover_image_url, video_url, visibility,
    source_type, source_id, source_submission_id,
    hackathon_track_ids, hackathon_sector_ids, hackathon_tech_stack_ids,
    created_at, updated_at
  ) VALUES (
    v_project_id, v_user_id, lower(btrim(p_slug)), btrim(p_title), NULLIF(btrim(p_summary), ''),
    NULLIF(btrim(p_demo_url), ''), NULLIF(btrim(p_repo_url), ''), NULLIF(btrim(p_slide_url), ''),
    NULLIF(btrim(p_screenshot_url), ''), COALESCE(NULLIF(btrim(p_cover_image_url), ''), NULLIF(btrim(p_screenshot_url), '')),
    NULLIF(btrim(p_video_url), ''), 'public',
    'hackathon', p_hackathon_id, v_submission_id,
    p_track_ids, p_sector_ids, p_tech_stack_ids, v_now, v_now
  )
  ON CONFLICT (owner_id, source_type, source_submission_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    demo_url = EXCLUDED.demo_url,
    repo_url = EXCLUDED.repo_url,
    slide_url = EXCLUDED.slide_url,
    screenshot_url = EXCLUDED.screenshot_url,
    cover_image_url = EXCLUDED.cover_image_url,
    video_url = EXCLUDED.video_url,
    hackathon_track_ids = EXCLUDED.hackathon_track_ids,
    hackathon_sector_ids = EXCLUDED.hackathon_sector_ids,
    hackathon_tech_stack_ids = EXCLUDED.hackathon_tech_stack_ids,
    updated_at = v_now
  RETURNING public.projects.id INTO v_project_id;

  INSERT INTO public.hackathon_submissions (id, hackathon_id, user_id, project_id, document)
  VALUES (
    v_submission_id,
    p_hackathon_id,
    v_user_id,
    v_project_id,
    jsonb_build_object(
      'registration_id', p_hackathon_id || '_' || v_user_id::text,
      'project_id', v_project_id,
      'title', btrim(p_title),
      'summary', NULLIF(btrim(p_summary), ''),
      'demo_url', NULLIF(btrim(p_demo_url), ''),
      'repo_url', NULLIF(btrim(p_repo_url), ''),
      'slide_url', NULLIF(btrim(p_slide_url), ''),
      'screenshot_url', NULLIF(btrim(p_screenshot_url), ''),
      'cover_image_url', COALESCE(NULLIF(btrim(p_cover_image_url), ''), NULLIF(btrim(p_screenshot_url), '')),
      'video_url', NULLIF(btrim(p_video_url), ''),
      'track_ids', p_track_ids,
      'sector_ids', p_sector_ids,
      'tech_stack_ids', p_tech_stack_ids,
      'submitted_at', v_now,
      'updated_at', v_now
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    project_id = EXCLUDED.project_id,
    document = public.hackathon_submissions.document || EXCLUDED.document;

  RETURN QUERY SELECT v_project_id, v_submission_id, lower(btrim(p_slug));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_hackathon_project(text, uuid, text, text, text, text, text, text, text, text, text, text[], text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_hackathon_project(text, uuid, text, text, text, text, text, text, text, text, text, text[], text[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION private.validate_hackathon_project_taxonomy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_document jsonb;
  v_tracks text[];
  v_sectors text[];
  v_tech_stacks text[];
  v_existing_tracks text[] := '{}';
  v_existing_sectors text[] := '{}';
  v_existing_tech_stacks text[] := '{}';
BEGIN
  IF NEW.source_type NOT IN ('contest', 'hackathon') THEN
    RETURN NEW;
  END IF;
  IF cardinality(NEW.hackathon_track_ids) = 0
    OR cardinality(NEW.hackathon_sector_ids) = 0
    OR cardinality(NEW.hackathon_tech_stack_ids) = 0
  THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy_required';
  END IF;
  SELECT h.document INTO v_document FROM public.hackathons h WHERE h.id = NEW.source_id;
  IF v_document IS NULL THEN
    RAISE EXCEPTION 'not_found:hackathon';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_existing_tracks := OLD.hackathon_track_ids;
    v_existing_sectors := OLD.hackathon_sector_ids;
    v_existing_tech_stacks := OLD.hackathon_tech_stack_ids;
  END IF;
  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_tracks
  FROM jsonb_array_elements(COALESCE(v_document->'tracks', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';
  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_sectors
  FROM jsonb_array_elements(COALESCE(v_document->'sectors', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';
  SELECT COALESCE(array_agg(item->>'id'), '{}') INTO v_tech_stacks
  FROM jsonb_array_elements(COALESCE(v_document->'tech_stacks', '[]'::jsonb)) item
  WHERE COALESCE(item->>'active', 'true') <> 'false';
  IF NOT NEW.hackathon_track_ids <@ (v_tracks || v_existing_tracks)
    OR NOT NEW.hackathon_sector_ids <@ (v_sectors || v_existing_sectors)
    OR NOT NEW.hackathon_tech_stack_ids <@ (v_tech_stacks || v_existing_tech_stacks)
  THEN
    RAISE EXCEPTION 'invalid_input:project_taxonomy';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_hackathon_project_taxonomy() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_validate_hackathon_project_taxonomy
  BEFORE INSERT OR UPDATE OF source_type, source_id, hackathon_track_ids, hackathon_sector_ids, hackathon_tech_stack_ids
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.validate_hackathon_project_taxonomy();

CREATE OR REPLACE FUNCTION private.prevent_used_hackathon_taxonomy_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id text;
BEGIN
  FOR v_id IN
    SELECT DISTINCT unnest(p.hackathon_track_ids)
    FROM public.projects p
    WHERE p.source_type IN ('contest', 'hackathon') AND p.source_id = NEW.id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.document->'tracks', '[]'::jsonb)) item WHERE item->>'id' = v_id) THEN
      RAISE EXCEPTION 'conflict:taxonomy_in_use';
    END IF;
  END LOOP;
  FOR v_id IN
    SELECT DISTINCT unnest(p.hackathon_sector_ids)
    FROM public.projects p
    WHERE p.source_type IN ('contest', 'hackathon') AND p.source_id = NEW.id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.document->'sectors', '[]'::jsonb)) item WHERE item->>'id' = v_id) THEN
      RAISE EXCEPTION 'conflict:taxonomy_in_use';
    END IF;
  END LOOP;
  FOR v_id IN
    SELECT DISTINCT unnest(p.hackathon_tech_stack_ids)
    FROM public.projects p
    WHERE p.source_type IN ('contest', 'hackathon') AND p.source_id = NEW.id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.document->'tech_stacks', '[]'::jsonb)) item WHERE item->>'id' = v_id) THEN
      RAISE EXCEPTION 'conflict:taxonomy_in_use';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_used_hackathon_taxonomy_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_prevent_used_hackathon_taxonomy_delete
  BEFORE UPDATE OF document ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION private.prevent_used_hackathon_taxonomy_delete();

-- Explicitly destructive product decision: no hackathon has run, so remove all
-- scoring and scoped access-invite data without preserving a snapshot.
DROP TABLE IF EXISTS public.hackathon_scores CASCADE;
DROP FUNCTION IF EXISTS public.hackathon_score_document_has_valid_ranges(jsonb);
DROP FUNCTION IF EXISTS internal.hackathon_scores_validate_and_normalize();

DROP TABLE IF EXISTS public.hackathon_access_invites CASCADE;
DROP FUNCTION IF EXISTS public.has_hackathon_invite_role(text, text[]);
DROP FUNCTION IF EXISTS private.has_hackathon_invite_role(text, text[]);
DROP FUNCTION IF EXISTS private.restrict_hackathon_invite_self_update();

-- Existing storage helpers now authorize admin/support only.
CREATE OR REPLACE FUNCTION private.can_manage_hackathon(p_hackathon_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin_or_support()
    AND EXISTS (SELECT 1 FROM public.hackathons h WHERE h.id = p_hackathon_id);
$$;

REVOKE ALL ON FUNCTION private.can_manage_hackathon(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_hackathon(text, uuid) TO authenticated;

COMMIT;
