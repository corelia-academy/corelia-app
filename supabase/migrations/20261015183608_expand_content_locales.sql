-- Expand content/email locales from ('vi','en') to
-- ('en','zh-CN','ko','es','zh-TW','vi','ja').

CREATE OR REPLACE FUNCTION private.supported_content_locales()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY['en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja']
$$;
REVOKE ALL ON FUNCTION private.supported_content_locales() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.supported_content_locales() TO service_role;

-- Region-aware: zh-TW/zh-Hant/zh-HK/zh-MO -> zh-TW; other zh (zh, zh-CN, zh-Hans, zh-SG) -> zh-CN.
CREATE OR REPLACE FUNCTION private.normalize_content_locale(p_locale text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH n AS (SELECT lower(replace(btrim(coalesce(p_locale, '')), '_', '-')) AS v)
  SELECT CASE
    WHEN v IN ('zh-tw', 'zh-hk', 'zh-mo') OR v = 'zh-hant' OR v LIKE 'zh-hant-%' THEN 'zh-TW'
    WHEN v = 'zh' OR v LIKE 'zh-%' THEN 'zh-CN'
    WHEN split_part(v, '-', 1) IN ('vi', 'vn') THEN 'vi'
    WHEN split_part(v, '-', 1) = 'en' THEN 'en'
    WHEN split_part(v, '-', 1) = 'ko' THEN 'ko'
    WHEN split_part(v, '-', 1) = 'es' THEN 'es'
    WHEN split_part(v, '-', 1) = 'ja' THEN 'ja'
    ELSE NULL
  END
  FROM n
$$;
REVOKE ALL ON FUNCTION private.normalize_content_locale(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.normalize_email_locale(p_locale text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.normalize_content_locale(p_locale)
$$;
REVOKE ALL ON FUNCTION private.normalize_email_locale(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.hackathon_locales DROP CONSTRAINT hackathon_locales_locale_check;
ALTER TABLE public.hackathon_locales ADD CONSTRAINT hackathon_locales_locale_check
  CHECK (locale IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja'));

ALTER TABLE public.project_locales DROP CONSTRAINT project_locales_locale_check;
ALTER TABLE public.project_locales ADD CONSTRAINT project_locales_locale_check
  CHECK (locale IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja'));

ALTER TABLE public.email_contacts DROP CONSTRAINT email_contacts_locale_check;
ALTER TABLE public.email_contacts ADD CONSTRAINT email_contacts_locale_check
  CHECK (locale IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja'));

ALTER TABLE public.email_campaign_recipients DROP CONSTRAINT email_campaign_recipients_resolved_locale_check;
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_resolved_locale_check
  CHECK (resolved_locale IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja'));

-- Email contact locale previously collapsed everything but 'en' into 'vi'.
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
    FROM unnest(private.supported_content_locales()) AS locale(code)
  )
  SELECT jsonb_typeof(p_content) = 'object'
    AND coalesce(bool_or(complete), false)
    AND coalesce(bool_and(NOT present OR complete), false)
  FROM copies
$$;
REVOKE ALL ON FUNCTION private.email_localized_content_complete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.email_localized_content_complete(jsonb) TO service_role;

-- Patch the remaining functions that hard-code the two-locale whitelist in place,
-- preserving their current bodies, ACLs and settings.
DO $$
DECLARE
  v_names text[] := ARRAY[
    'save_ai_gated_project_locale', 'update_ai_gated_project_i18n', 'save_ai_gated_project',
    'save_ai_gated_project_taxonomy', 'learning_save_lesson', 'learning_save_course',
    'learning_save_course_info', 'learning_locale_copy_valid', 'enqueue_email_automations'
  ];
  v_all constant text := '(''en'', ''zh-CN'', ''ko'', ''es'', ''zh-TW'', ''vi'', ''ja'')';
  v_name text;
  v_proc record;
  v_def text;
  v_new text;
  v_patched int;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    v_patched := 0;
    FOR v_proc IN
      SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname IN ('public', 'private') AND p.proname = v_name
    LOOP
      v_def := pg_get_functiondef(v_proc.oid);
      v_new := regexp_replace(v_def, '\(\s*''vi''\s*,\s*''en''\s*\)', v_all, 'g');
      v_new := replace(v_new, 'CASE WHEN p.locale = ''en'' THEN ''en'' ELSE ''vi'' END',
        'coalesce(private.normalize_content_locale(p.locale), ''vi'')');
      -- Thin wrappers that only delegate to the private implementation have nothing to patch.
      CONTINUE WHEN v_new = v_def;
      EXECUTE v_new;
      v_patched := v_patched + 1;
    END LOOP;
    IF v_patched = 0 THEN
      RAISE EXCEPTION 'expand_content_locales: nothing to patch in %', v_name;
    END IF;
  END LOOP;
END
$$;

-- Display names for every locale; name_vi/name_en stay for existing readers.
ALTER TABLE public.project_taxonomy_options ADD COLUMN names jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.project_taxonomy_options SET names = jsonb_build_object('vi', name_vi, 'en', name_en);
