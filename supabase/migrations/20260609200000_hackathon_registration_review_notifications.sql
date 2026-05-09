-- In-app notifications when hackathon registration is approved or rejected.

BEGIN;

CREATE OR REPLACE FUNCTION private.notify_hackathon_registration_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text := COALESCE(OLD.document->>'status', '');
  new_status text := COALESCE(NEW.document->>'status', '');
  v_slug text;
  v_title text;
  v_type text;
BEGIN
  IF new_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  SELECT
    NULLIF(trim(h.document->>'slug'), ''),
    NULLIF(trim(h.document->>'title'), '')
  INTO v_slug, v_title
  FROM public.hackathons h
  WHERE h.id = NEW.hackathon_id;

  IF new_status = 'approved' THEN
    v_type := 'hackathon_registration_approved';
  ELSE
    v_type := 'hackathon_registration_rejected';
  END IF;

  INSERT INTO public.user_notifications (user_id, type, payload)
  VALUES (
    NEW.user_id,
    v_type,
    jsonb_build_object(
      'hackathon_id', NEW.hackathon_id,
      'registration_id', NEW.id,
      'hackathon_slug', COALESCE(v_slug, ''),
      'hackathon_title', COALESCE(v_title, ''),
      'review_note', to_jsonb(NEW.document->>'review_note'),
      'reviewed_at', NEW.document->>'reviewed_at'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hackathon_registrations_notify_review ON public.hackathon_registrations;
CREATE TRIGGER trg_hackathon_registrations_notify_review
  AFTER UPDATE OF document ON public.hackathon_registrations
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_hackathon_registration_review();

COMMIT;
