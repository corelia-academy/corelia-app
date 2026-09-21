-- Template writes run as service_role. The invoker trigger must be able to
-- validate translations without granting browser roles access to the helper.
GRANT EXECUTE ON FUNCTION private.email_localized_content_complete(jsonb) TO service_role;
