-- Additional v1 activity events from the issue vocabulary.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.can_read_activity_subject(
  p_subject_type text,
  p_subject_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RETURN true;
  END IF;

  IF p_subject_type IN ('lesson', 'section') THEN
    RETURN true;
  END IF;

  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_subject_id::uuid
        AND (
          COALESCE(p.profile_public, false) = true
          OR p.id = p_user_id
          OR public.is_admin_or_support()
        )
    );
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_subject_id
        AND (
          c.published = true
          OR c.instructor_id = p_user_id
          OR public.is_admin_or_support()
          OR COALESCE(c.data->'co_instructor_permissions', '{}'::jsonb) ? COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND (
          h.status IN ('published', 'running', 'ended', 'winners_announced')
          OR public.is_admin_or_support()
          OR (h.document->>'created_by') = COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN private.can_read_project_content(p_subject_id::uuid, p_user_id);
  END IF;

  IF p_subject_type = 'credential' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.id = p_subject_id::uuid
        AND (ci.status = 'minted' OR ci.user_id = p_user_id OR public.is_admin_or_support())
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION private.can_read_activity_subject(text, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.course_activity_payload(
  p_course_id text,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT COALESCE(
    (
      SELECT p_extra || jsonb_build_object(
        'course_slug', NULLIF(trim(c.slug), ''),
        'course_title', COALESCE(NULLIF(trim(c.data->>'title'), ''), c.id)
      )
      FROM public.courses c
      WHERE c.id = p_course_id
    ),
    p_extra
  );
$$;

CREATE OR REPLACE FUNCTION private.project_activity_payload(
  p_project_id uuid,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT COALESCE(
    (
      SELECT p_extra || jsonb_build_object(
        'project_title', p.title
      )
      FROM public.projects p
      WHERE p.id = p_project_id
    ),
    p_extra
  );
$$;

CREATE OR REPLACE FUNCTION private.emit_activity_on_course_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_should_emit boolean := false;
BEGIN
  IF NEW.published = true THEN
    IF TG_OP = 'INSERT' THEN
      v_should_emit := true;
    ELSIF TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM true THEN
      v_should_emit := true;
    END IF;
  END IF;

  IF v_should_emit THEN
    PERFORM private.log_activity(
      NEW.instructor_id,
      'course.published',
      'course',
      NEW.id,
      NULL,
      NULL,
      private.course_activity_payload(NEW.id),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_course_publish ON public.courses;
CREATE TRIGGER trg_activity_course_publish
  AFTER INSERT OR UPDATE OF published ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_course_publish();

CREATE OR REPLACE FUNCTION private.emit_activity_on_course_section_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor uuid;
  v_published boolean;
BEGIN
  SELECT c.instructor_id, c.published
  INTO v_actor, v_published
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF v_actor IS NOT NULL AND v_published = true THEN
    PERFORM private.log_activity(
      v_actor,
      'course.new_section',
      'course',
      NEW.course_id,
      'section',
      NEW.id,
      private.course_activity_payload(
        NEW.course_id,
        jsonb_build_object(
          'section_id', NEW.id,
          'section_title', COALESCE(NULLIF(trim(NEW.data->>'title'), ''), NEW.id)
        )
      ),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_course_section_insert ON public.course_sections;
CREATE TRIGGER trg_activity_course_section_insert
  AFTER INSERT ON public.course_sections
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_course_section_insert();

CREATE OR REPLACE FUNCTION private.emit_activity_on_project_hearts_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_heart_count integer;
  v_visibility text;
BEGIN
  SELECT *
  INTO v_project
  FROM public.projects
  WHERE id = NEW.project_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO v_heart_count
  FROM public.project_hearts
  WHERE project_id = NEW.project_id;

  IF v_heart_count NOT IN (10, 50, 100) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.activity_events e
    WHERE e.verb = 'project.received_hearts_milestone'
      AND e.object_type = 'project'
      AND e.object_id = NEW.project_id::text
      AND e.payload->>'milestone' = v_heart_count::text
  ) THEN
    RETURN NEW;
  END IF;

  v_visibility := COALESCE(private.activity_visibility_for_project(NEW.project_id), 'private');

  PERFORM private.log_activity(
    v_project.owner_id,
    'project.received_hearts_milestone',
    'project',
    NEW.project_id::text,
    NULL,
    NULL,
    private.project_activity_payload(
      NEW.project_id,
      jsonb_build_object(
        'milestone', v_heart_count,
        'like_count', v_heart_count
      )
    ),
    v_visibility
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_project_hearts_milestone ON public.project_hearts;
CREATE TRIGGER trg_activity_project_hearts_milestone
  AFTER INSERT ON public.project_hearts
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_project_hearts_milestone();
