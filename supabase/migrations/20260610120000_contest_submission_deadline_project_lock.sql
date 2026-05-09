-- Lock mirrored submission fields on contest-linked projects after effective submission deadline.

CREATE OR REPLACE FUNCTION private.enforce_contest_project_submission_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc jsonb;
  v_sub text;
  v_end text;
  v_deadline timestamptz;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type IS DISTINCT FROM 'contest' OR NEW.source_id IS NULL OR NEW.source_id = '' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  SELECT h.document
  INTO v_doc
  FROM public.hackathons h
  WHERE h.id::text = NEW.source_id;

  IF v_doc IS NULL THEN
    RETURN NEW;
  END IF;

  v_sub := NULLIF(btrim(v_doc->>'submission_deadline'), '');
  v_end := NULLIF(btrim(v_doc->>'ends_at'), '');

  v_deadline := NULL;
  IF v_sub IS NOT NULL THEN
    BEGIN
      v_deadline := v_sub::timestamptz;
    EXCEPTION
      WHEN OTHERS THEN
        v_deadline := NULL;
    END;
  END IF;
  IF v_deadline IS NULL AND v_end IS NOT NULL THEN
    BEGIN
      v_deadline := v_end::timestamptz;
    EXCEPTION
      WHEN OTHERS THEN
        v_deadline := NULL;
    END;
  END IF;

  IF v_deadline IS NULL THEN
    RETURN NEW;
  END IF;

  IF clock_timestamp() <= v_deadline THEN
    RETURN NEW;
  END IF;

  IF (NEW.title IS DISTINCT FROM OLD.title)
    OR (NEW.summary IS DISTINCT FROM OLD.summary)
    OR (NEW.demo_url IS DISTINCT FROM OLD.demo_url)
    OR (NEW.repo_url IS DISTINCT FROM OLD.repo_url)
    OR (NEW.slide_url IS DISTINCT FROM OLD.slide_url)
  THEN
    RAISE EXCEPTION 'CONTEST_SUBMISSION_LOCKED'
      USING HINT = 'Submission fields are frozen after the hackathon submission deadline.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_contest_project_submission_lock ON public.projects;
CREATE TRIGGER trg_enforce_contest_project_submission_lock
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_contest_project_submission_lock();
