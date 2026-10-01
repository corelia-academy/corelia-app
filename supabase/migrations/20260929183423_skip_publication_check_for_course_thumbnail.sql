-- Cover artwork does not affect whether published lessons are valid.
-- A write that also changes course content or publication state still runs the guard.
DROP TRIGGER learning_publication_update ON public.courses;
CREATE CONSTRAINT TRIGGER learning_publication_update AFTER UPDATE ON public.courses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
WHEN ((OLD.data-'total_duration_seconds'-'thumbnail_url'-'thumbnail_path')
      IS DISTINCT FROM (NEW.data-'total_duration_seconds'-'thumbnail_url'-'thumbnail_path')
 OR OLD.published IS DISTINCT FROM NEW.published
 OR OLD.archived_at IS DISTINCT FROM NEW.archived_at)
EXECUTE FUNCTION private.learning_publication_guard();
