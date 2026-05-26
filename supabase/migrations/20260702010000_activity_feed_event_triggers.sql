-- Activity event emitters for the v1 feed.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.can_read_activity_subject(
  p_subject_type text,
  p_subject_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
BEGIN
  IF p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RETURN true;
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = p_subject_id
        AND c.published = true
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND h.status IN ('published', 'running', 'ended')
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_subject_id::uuid
        AND (
          p.visibility = 'public'
          OR p.owner_id = p_user_id
          OR EXISTS (
            SELECT 1
            FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = p_user_id
          )
        )
    );
  END IF;

  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = p_subject_id::uuid
        AND (COALESCE(pr.profile_public, true) OR pr.id = p_user_id)
    );
  END IF;

  IF p_subject_type = 'credential' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM public.credential_issuances ci
      WHERE ci.id = p_subject_id::uuid
        AND (ci.status = 'minted' OR ci.user_id = p_user_id)
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.activity_visibility_for_project(p_project_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN p.visibility = 'public' THEN 'public'
    WHEN p.visibility = 'unlisted' THEN 'followers'
    ELSE 'private'
  END
  FROM public.projects p
  WHERE p.id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION private.emit_activity_on_enrollment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.log_activity(
    NEW.user_id,
    'user.enrolled_course',
    'course',
    NEW.course_id,
    'user',
    NEW.user_id::text,
    jsonb_build_object('enrollment_id', NEW.id),
    'public'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_enrollment_insert ON public.enrollments;
CREATE TRIGGER trg_activity_enrollment_insert
  AFTER INSERT ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_enrollment_insert();

CREATE OR REPLACE FUNCTION private.emit_activity_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.certificate_issued_at IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.certificate_issued_at IS NULL)
  THEN
    PERFORM private.log_activity(
      NEW.user_id,
      'user.completed_course',
      'course',
      NEW.course_id,
      'user',
      NEW.user_id::text,
      jsonb_build_object('enrollment_id', NEW.id),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_course_completion ON public.enrollments;
CREATE TRIGGER trg_activity_course_completion
  AFTER INSERT OR UPDATE OF certificate_issued_at ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_course_completion();

CREATE OR REPLACE FUNCTION private.emit_activity_on_lesson_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.completed_at IS NULL)
  THEN
    PERFORM private.log_activity(
      NEW.user_id,
      'user.completed_section',
      'course',
      NEW.course_id,
      'lesson',
      NEW.lesson_id,
      jsonb_build_object('lesson_progress_id', NEW.id),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_lesson_completion ON public.lesson_progress;
CREATE TRIGGER trg_activity_lesson_completion
  AFTER INSERT OR UPDATE OF completed_at ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_lesson_completion();

CREATE OR REPLACE FUNCTION private.emit_activity_on_hackathon_registration_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.log_activity(
    NEW.user_id,
    'user.registered_hackathon',
    'hackathon',
    NEW.hackathon_id,
    'user',
    NEW.user_id::text,
    jsonb_build_object('registration_id', NEW.id),
    'public'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_hackathon_registration_insert ON public.hackathon_registrations;
CREATE TRIGGER trg_activity_hackathon_registration_insert
  AFTER INSERT ON public.hackathon_registrations
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_hackathon_registration_insert();

CREATE OR REPLACE FUNCTION private.emit_activity_on_hackathon_submission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.log_activity(
    NEW.user_id,
    'user.submitted_hackathon',
    'hackathon',
    NEW.hackathon_id,
    'user',
    NEW.user_id::text,
    jsonb_build_object('submission_id', NEW.id),
    'public'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_hackathon_submission_insert ON public.hackathon_submissions;
CREATE TRIGGER trg_activity_hackathon_submission_insert
  AFTER INSERT ON public.hackathon_submissions
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_hackathon_submission_insert();

CREATE OR REPLACE FUNCTION private.emit_activity_on_hackathon_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('published', 'running', 'ended', 'winners_announced')
  THEN
    IF private.is_uuid_text(COALESCE(NEW.document->>'created_by', '')) THEN
      v_actor := (NEW.document->>'created_by')::uuid;
    ELSE
      SELECT p.id INTO v_actor
      FROM public.profiles p
      WHERE p.role IN ('admin', 'support_staff')
      ORDER BY p.created_at ASC
      LIMIT 1;
    END IF;

    IF v_actor IS NOT NULL THEN
      PERFORM private.log_activity(
        v_actor,
        'hackathon.status_changed',
        'hackathon',
        NEW.id,
        NULL,
        NULL,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
        'public'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_hackathon_status_change ON public.hackathons;
CREATE TRIGGER trg_activity_hackathon_status_change
  AFTER UPDATE OF status ON public.hackathons
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_hackathon_status_change();

CREATE OR REPLACE FUNCTION private.emit_activity_on_project_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_became_public boolean;
BEGIN
  v_became_public := NEW.visibility = 'public'
    AND (TG_OP = 'INSERT' OR OLD.visibility IS DISTINCT FROM 'public');

  IF v_became_public THEN
    PERFORM private.log_activity(
      NEW.owner_id,
      'user.published_project',
      'project',
      NEW.id::text,
      'user',
      NEW.owner_id::text,
      jsonb_build_object('source_type', NEW.source_type, 'source_id', NEW.source_id),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_project_publish ON public.projects;
CREATE TRIGGER trg_activity_project_publish
  AFTER INSERT OR UPDATE OF visibility ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_project_publish();

CREATE OR REPLACE FUNCTION private.emit_activity_on_project_collaborator_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_visibility text;
BEGIN
  v_visibility := COALESCE(private.activity_visibility_for_project(NEW.project_id), 'private');

  PERFORM private.log_activity(
    NEW.user_id,
    'user.joined_project',
    'project',
    NEW.project_id::text,
    'user',
    NEW.user_id::text,
    jsonb_build_object('role', NEW.role),
    v_visibility
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_project_collaborator_insert ON public.project_collaborators;
CREATE TRIGGER trg_activity_project_collaborator_insert
  AFTER INSERT ON public.project_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_project_collaborator_insert();

CREATE OR REPLACE FUNCTION private.emit_activity_on_credential_issuance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_object_type text := 'credential';
  v_object_id text := NEW.id::text;
  v_target_type text;
  v_target_id text;
BEGIN
  IF NEW.status <> 'minted' THEN
    RETURN NEW;
  END IF;

  IF NEW.course_id IS NOT NULL THEN
    v_target_type := 'course';
    v_target_id := NEW.course_id;
  ELSIF NEW.hackathon_id IS NOT NULL THEN
    v_target_type := 'hackathon';
    v_target_id := NEW.hackathon_id;
  END IF;

  PERFORM private.log_activity(
    NEW.user_id,
    'user.earned_credential',
    v_object_type,
    v_object_id,
    v_target_type,
    v_target_id,
    jsonb_build_object(
      'template_id', NEW.template_id,
      'course_id', NEW.course_id,
      'hackathon_id', NEW.hackathon_id,
      'oc_credential_id', NEW.oc_credential_id
    ),
    'public'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_credential_issuance ON public.credential_issuances;
CREATE TRIGGER trg_activity_credential_issuance
  AFTER INSERT OR UPDATE OF status ON public.credential_issuances
  FOR EACH ROW
  WHEN (NEW.status = 'minted')
  EXECUTE FUNCTION private.emit_activity_on_credential_issuance();
