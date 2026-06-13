-- Add a conservative database-side moderation gate before a creator course can
-- become public. This catches direct API/RLS bypass attempts that skip UI review.

CREATE OR REPLACE FUNCTION private.course_publish_text_blob(
  p_course_id text,
  p_course_data jsonb
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT lower(
    concat_ws(
      E'\n',
      COALESCE(p_course_data, '{}'::jsonb)::text,
      (
        SELECT string_agg(COALESCE(cl.data, '{}'::jsonb)::text, E'\n')
        FROM public.course_locales cl
        WHERE cl.course_id = p_course_id
      ),
      (
        SELECT string_agg(COALESCE(cs.data, '{}'::jsonb)::text, E'\n')
        FROM public.course_sections cs
        WHERE cs.course_id = p_course_id
      ),
      (
        SELECT string_agg(COALESCE(csl.data, '{}'::jsonb)::text, E'\n')
        FROM public.course_section_locales csl
        WHERE csl.course_id = p_course_id
      ),
      (
        SELECT string_agg(COALESCE(l.data, '{}'::jsonb)::text, E'\n')
        FROM public.course_lessons l
        WHERE l.course_id = p_course_id
      ),
      (
        SELECT string_agg(COALESCE(ll.data, '{}'::jsonb)::text, E'\n')
        FROM public.course_lesson_locales ll
        WHERE ll.course_id = p_course_id
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.course_publish_url_count(p_text text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(*)::int
  FROM regexp_matches(COALESCE(p_text, ''), 'https?://', 'gi');
$$;

CREATE OR REPLACE FUNCTION private.moderate_course_for_publish(
  p_course_id text,
  p_course_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_title text := btrim(COALESCE(p_course_data->>'title', ''));
  v_description text := btrim(COALESCE(
    NULLIF(p_course_data->>'description', ''),
    NULLIF(p_course_data->>'short_description', ''),
    ''
  ));
  v_lesson_count int := 0;
  v_text text;
  v_url_count int := 0;
  v_match text;
BEGIN
  IF p_course_id IS NULL OR p_course_id = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'course_missing');
  END IF;

  IF char_length(v_title) < 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publish_title_too_short',
      'field', 'title'
    );
  END IF;

  IF char_length(v_description) < 20 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publish_description_too_short',
      'field', 'description'
    );
  END IF;

  SELECT count(*)::int
    INTO v_lesson_count
  FROM public.course_lessons l
  WHERE l.course_id = p_course_id
    AND COALESCE(l.data->>'deleted_at', '') = '';

  IF v_lesson_count < 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publish_requires_lesson',
      'current', v_lesson_count,
      'limit', 1
    );
  END IF;

  v_text := private.course_publish_text_blob(p_course_id, p_course_data);
  v_url_count := private.course_publish_url_count(v_text);

  IF v_url_count > 20 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publish_link_farm',
      'current', v_url_count,
      'limit', 20
    );
  END IF;

  SELECT matched.match[2]
    INTO v_match
  FROM regexp_matches(
    v_text,
    '(^|[^a-z0-9])(' ||
      'buy[[:space:]-]+followers|' ||
      'free[[:space:]-]+followers|' ||
      'casino|' ||
      'gambling|' ||
      'sportsbook|' ||
      'porn|' ||
      'xxx|' ||
      'onlyfans|' ||
      'escort|' ||
      'seed[[:space:]-]+phrase|' ||
      'wallet[[:space:]-]+seed|' ||
      'private[[:space:]-]+key|' ||
      'mnemonic[[:space:]-]+phrase|' ||
      'exam[[:space:]-]+dumps|' ||
      'fake[[:space:]-]+certificate|' ||
      'degree[[:space:]-]+for[[:space:]-]+sale|' ||
      'hack[[:space:]-]+account|' ||
      'crack[[:space:]-]+software|' ||
      'keygen' ||
    ')([^a-z0-9]|$)',
    'i'
  ) AS matched(match)
  LIMIT 1;

  IF v_match IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publish_blocked_content',
      'pattern', v_match
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'lesson_count', v_lesson_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_creator_course_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quota jsonb;
  v_moderation jsonb;
BEGIN
  IF v_user_id IS NULL OR public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  IF NEW.instructor_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'course_owner_must_match_current_user'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.published = true THEN
      RAISE EXCEPTION 'new_courses_must_start_as_draft'
        USING ERRCODE = '42501';
    END IF;

    v_quota := public.check_course_quota('create_course');
    IF COALESCE((v_quota->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'course_quota_exceeded:%', COALESCE(v_quota->>'reason', 'unknown')
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM true AND NEW.published = true THEN
    v_quota := public.check_course_quota('publish_course');
    IF COALESCE((v_quota->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'course_quota_exceeded:%', COALESCE(v_quota->>'reason', 'unknown')
        USING ERRCODE = '23514';
    END IF;

    v_moderation := private.moderate_course_for_publish(NEW.id, NEW.data);
    IF COALESCE((v_moderation->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'course_publish_moderation_failed:%', COALESCE(v_moderation->>'reason', 'unknown')
        USING ERRCODE = '23514';
    END IF;

    NEW.data := COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
      'moderation_status', 'passed',
      'moderation_checked_at', now()
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.course_publish_text_blob(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.course_publish_url_count(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.moderate_course_for_publish(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.course_publish_text_blob(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.course_publish_url_count(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.moderate_course_for_publish(text, jsonb) TO authenticated;
