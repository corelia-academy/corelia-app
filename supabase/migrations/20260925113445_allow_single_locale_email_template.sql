-- A published email needs one complete language. An empty editor tab is absent;
-- a partially written second language still blocks publication.
CREATE OR REPLACE FUNCTION private.email_localized_content_complete(p_content jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH copies AS (
    SELECT
      nullif(btrim(p_content->locale.code->>'subject'), '') IS NOT NULL
        AND nullif(btrim(p_content->locale.code->>'body_text'), '') IS NOT NULL AS complete,
      btrim(concat_ws('',
        p_content->locale.code->>'subject', p_content->locale.code->>'preheader',
        p_content->locale.code->>'body_text', p_content->locale.code->>'cta_label',
        p_content->locale.code->>'cta_url', p_content->locale.code->>'image_url'
      )) <> '' AS present
    FROM (VALUES ('vi'), ('en')) AS locale(code)
  )
  SELECT jsonb_typeof(p_content) = 'object'
    AND coalesce(bool_or(complete), false)
    AND coalesce(bool_and(NOT present OR complete), false)
  FROM copies
$$;
REVOKE ALL ON FUNCTION private.email_localized_content_complete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.email_localized_content_complete(jsonb) TO service_role;
