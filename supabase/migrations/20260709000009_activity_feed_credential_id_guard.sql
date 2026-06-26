-- Guard earned-credential activity events behind the same on-chain proof used by
-- the Achievements UI: a minted issuance must also have a non-empty OC id.
-- This also lets backfills emit the event when oc_credential_id is repaired.

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
  IF NEW.status <> 'minted'
    OR NEW.oc_credential_id IS NULL
    OR trim(NEW.oc_credential_id) = ''
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.activity_events e
    WHERE e.actor_id = NEW.user_id
      AND e.verb = 'user.earned_credential'
      AND e.object_type = v_object_type
      AND e.object_id = v_object_id
  ) THEN
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

DROP TRIGGER IF EXISTS trg_activity_credential_issuance ON public.credential_issuances;
CREATE TRIGGER trg_activity_credential_issuance
  AFTER INSERT OR UPDATE OF status, oc_credential_id ON public.credential_issuances
  FOR EACH ROW
  WHEN (
    NEW.status = 'minted'
    AND NEW.oc_credential_id IS NOT NULL
    AND trim(NEW.oc_credential_id) <> ''
  )
  EXECUTE FUNCTION private.emit_activity_on_credential_issuance();
