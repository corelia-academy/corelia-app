-- Saving a project reset supported_locales to a fixed list (vi/en, then all seven after expand_content_locales)
-- whatever the project had enabled.
-- Keep any locales already enabled, always include the primary, and otherwise start with just the primary.
CREATE OR REPLACE FUNCTION private.project_supported_locales(p_i18n jsonb, p_primary text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_agg(l ORDER BY (l <> p_primary), l)
  FROM (
    SELECT p_primary AS l
    UNION
    SELECT x FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p_i18n->'supported_locales') = 'array' THEN p_i18n->'supported_locales' ELSE '[]'::jsonb END
    ) AS x
    WHERE x = ANY (private.supported_content_locales())
  ) s
$$;
REVOKE ALL ON FUNCTION private.project_supported_locales(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.project_supported_locales(jsonb, text) TO service_role;

DO $$
DECLARE
  v_name text;
  v_proc record;
  v_def text;
  v_new text;
  v_patched int;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['save_ai_gated_project', 'save_ai_gated_project_taxonomy'] LOOP
    v_patched := 0;
    FOR v_proc IN
      SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'private') AND p.proname = v_name
    LOOP
      v_def := pg_get_functiondef(v_proc.oid);
      v_new := regexp_replace(v_def, 'jsonb_build_array\(\s*''en''\s*,\s*''zh-CN''\s*,\s*''ko''\s*,\s*''es''\s*,\s*''zh-TW''\s*,\s*''vi''\s*,\s*''ja''\s*\)',
        'private.project_supported_locales(i18n, v_primary)', 'g');
      CONTINUE WHEN v_new = v_def;
      EXECUTE v_new;
      v_patched := v_patched + 1;
    END LOOP;
    IF v_patched = 0 THEN
      RAISE EXCEPTION 'project_supported_locales: nothing to patch in %', v_name;
    END IF;
  END LOOP;
END
$$;
