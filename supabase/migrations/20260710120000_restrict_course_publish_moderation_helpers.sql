-- The publish moderation helpers are only used internally by the course write
-- trigger. Keep them private so clients cannot call the scan helpers directly.

REVOKE ALL ON FUNCTION private.course_publish_text_blob(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.course_publish_text_blob(text, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION private.course_publish_url_count(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.course_publish_url_count(text) FROM authenticated;
REVOKE ALL ON FUNCTION private.moderate_course_for_publish(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.moderate_course_for_publish(text, jsonb) FROM authenticated;
