-- R4 forward reconciliation for live Staging function-definition drift.
-- No historical migration is rewritten; existing rows are preserved.

CREATE OR REPLACE FUNCTION internal.delete_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.public_profiles WHERE id = OLD.id;
  RETURN OLD;
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
    END || private.credential_template_activity_payload(NEW.template_id),
    'public'
  );

  RETURN NEW;
END;
$$;

-- Repair historical milestone activity rows that were produced by the drifted
-- Staging function without a template title.
UPDATE public.activity_events e
SET payload = e.payload || jsonb_build_object(
  'title', NULLIF(trim(t.name), '')
)
FROM public.credential_templates t
WHERE e.verb = 'user.earned_credential'
  AND e.payload ? 'template_id'
  AND t.id = (e.payload->>'template_id')::uuid
  AND NOT (e.payload ? 'title');
