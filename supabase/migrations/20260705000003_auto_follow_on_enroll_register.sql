-- Auto-follow: enrolling in a course follows the course,
-- registering for a hackathon follows the hackathon.
-- ON CONFLICT DO NOTHING so re-enrollment / re-registration never errors.

CREATE OR REPLACE FUNCTION private.auto_follow_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  INSERT INTO public.follows (follower_id, subject_type, subject_id)
  VALUES (NEW.user_id, 'course', NEW.course_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_follow_enrollment ON public.enrollments;
CREATE TRIGGER trg_auto_follow_enrollment
  AFTER INSERT ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_follow_on_enrollment();

CREATE OR REPLACE FUNCTION private.auto_follow_on_hackathon_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  INSERT INTO public.follows (follower_id, subject_type, subject_id)
  VALUES (NEW.user_id, 'hackathon', NEW.hackathon_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_follow_hackathon_registration ON public.hackathon_registrations;
CREATE TRIGGER trg_auto_follow_hackathon_registration
  AFTER INSERT ON public.hackathon_registrations
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_follow_on_hackathon_registration();
