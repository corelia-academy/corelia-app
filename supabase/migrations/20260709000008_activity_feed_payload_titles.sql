-- Enrich activity_events payloads with the subject's display title/slug.
--
-- Learner events (enroll / complete course / complete lesson / earn credential)
-- and non-user follow events previously stored only opaque ids in `payload`, so
-- the activity feed fell back to rendering the generic noun ("course",
-- "credential") instead of the real course name, and links pointed at the actor
-- instead of the content. The trigger functions below mirror the enrichment that
-- course.published / course.new_section already use, and the backfill repairs
-- rows emitted before this migration.

-- -----------------------------------------------------------------------------
-- Trigger functions
-- -----------------------------------------------------------------------------

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
    private.course_activity_payload(
      NEW.course_id,
      jsonb_build_object('enrollment_id', NEW.id)
    ),
    'public'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.emit_activity_on_course_completion()
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
      'user.completed_course',
      'course',
      NEW.course_id,
      'user',
      NEW.user_id::text,
      private.course_activity_payload(
        NEW.course_id,
        jsonb_build_object(
          'enrollment_id', NEW.id,
          'completed_at', NEW.completed_at
        )
      ),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

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
      private.course_activity_payload(
        NEW.course_id,
        jsonb_build_object('lesson_progress_id', NEW.id)
      ),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

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
    ) ||
    CASE
      WHEN NEW.hackathon_id IS NOT NULL
        THEN private.hackathon_activity_payload(NEW.hackathon_id)
      WHEN NEW.course_id IS NOT NULL
        THEN private.course_activity_payload(NEW.course_id)
      ELSE '{}'::jsonb
    END,
    'public'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.follows_emit_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_payload jsonb := jsonb_build_object(
    'subject_type', NEW.subject_type,
    'subject_id', NEW.subject_id
  );
BEGIN
  IF NEW.subject_type = 'course' THEN
    v_payload := private.course_activity_payload(NEW.subject_id, v_payload);
  ELSIF NEW.subject_type = 'hackathon' THEN
    v_payload := private.hackathon_activity_payload(NEW.subject_id, v_payload);
  ELSIF NEW.subject_type = 'project'
    AND private.is_uuid_text(NEW.subject_id) THEN
    v_payload := private.project_activity_payload(NEW.subject_id::uuid, v_payload);
  END IF;

  PERFORM private.log_activity(
    NEW.follower_id,
    'user.followed_' || NEW.subject_type,
    'user',
    NEW.follower_id::text,
    NEW.subject_type,
    NEW.subject_id,
    v_payload,
    'public'
  );

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Backfill existing rows
-- -----------------------------------------------------------------------------

-- Course-centric learner verbs: the course id is the object_id.
UPDATE public.activity_events e
SET payload = e.payload || jsonb_build_object(
  'course_slug', NULLIF(trim(c.slug), ''),
  'course_title', COALESCE(NULLIF(trim(c.data->>'title'), ''), c.id)
)
FROM public.courses c
WHERE e.verb IN (
    'user.enrolled_course',
    'user.completed_course',
    'user.completed_section'
  )
  AND e.object_type = 'course'
  AND c.id = e.object_id
  AND NOT (e.payload ? 'course_title');

-- Credential earned for a course: the course id is the target_id.
UPDATE public.activity_events e
SET payload = e.payload || jsonb_build_object(
  'course_slug', NULLIF(trim(c.slug), ''),
  'course_title', COALESCE(NULLIF(trim(c.data->>'title'), ''), c.id)
)
FROM public.courses c
WHERE e.verb = 'user.earned_credential'
  AND e.target_type = 'course'
  AND c.id = e.target_id
  AND NOT (e.payload ? 'course_title');

-- Followed a course.
UPDATE public.activity_events e
SET payload = e.payload || jsonb_build_object(
  'course_slug', NULLIF(trim(c.slug), ''),
  'course_title', COALESCE(NULLIF(trim(c.data->>'title'), ''), c.id)
)
FROM public.courses c
WHERE e.verb = 'user.followed_course'
  AND e.target_type = 'course'
  AND c.id = e.target_id
  AND NOT (e.payload ? 'course_title');
