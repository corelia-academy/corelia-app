-- Transactional audit log for edits to AI-generated courses.
-- Change records stay after course deletion and contain field-level old/new values only.

CREATE TABLE public.studio_course_edits (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  course_id text NOT NULL,
  txid bigint NOT NULL,
  actor_id uuid,
  actor_name text,
  source text NOT NULL
    CHECK (source IN ('app_manual', 'studio_ai', 'studio_manual')),
  source_ref jsonb,
  changes jsonb NOT NULL
    CHECK (pg_catalog.jsonb_typeof(changes) = 'array'),
  CONSTRAINT studio_course_edits_txid_course_id_key UNIQUE (txid, course_id)
);

CREATE INDEX studio_course_edits_course_occurred_at_idx
  ON public.studio_course_edits (course_id, occurred_at DESC, id DESC);

ALTER TABLE public.studio_course_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.studio_course_edits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.studio_course_edits TO authenticated;

CREATE POLICY studio_course_edits_admin_read
  ON public.studio_course_edits
  FOR SELECT TO authenticated
  USING ((SELECT public.studio_can_write()));

CREATE FUNCTION private.edit_log_context(
  p_source text,
  p_actor uuid,
  p_ref jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('app_manual', 'studio_ai', 'studio_manual') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'EDIT_LOG_FAILED: unsupported edit source',
      ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.set_config('app.studio_course_edit_log_source', p_source, true);
  PERFORM pg_catalog.set_config('app.studio_course_edit_log_actor', COALESCE(p_actor::text, ''), true);
  PERFORM pg_catalog.set_config('app.studio_course_edit_log_ref', COALESCE(p_ref::text, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION private.edit_log_context(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.capture_studio_course_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row jsonb := '{}'::jsonb;
  v_new_row jsonb := '{}'::jsonb;
  v_old_data jsonb := '{}'::jsonb;
  v_new_data jsonb := '{}'::jsonb;
  v_label_data jsonb := '{}'::jsonb;
  v_parent_data jsonb;
  -- Keep automatically maintained values centralized so they cannot appear as content edits.
  v_ignored_columns constant text[] := ARRAY['created_at', 'updated_at', 'follower_count'];
  v_ignored_data_keys constant text[] := ARRAY['updated_at', 'total_duration_seconds'];
  v_context_source text;
  v_actor_text text;
  v_context_ref text;
  v_source text;
  v_source_ref jsonb;
  v_actor uuid;
  v_actor_name text;
  v_entity text;
  v_entity_id text;
  v_locale text;
  v_label text;
  v_fields jsonb := '{}'::jsonb;
  v_field_change jsonb;
  v_old_value jsonb;
  v_new_value jsonb;
  v_key text;
  v_course_ids text[] := ARRAY[]::text[];
  v_log_course_ids text[] := ARRAY[]::text[];
  v_course_id text;
  v_is_ai boolean;
  v_txid bigint;
  v_change jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_row := pg_catalog.to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_row := pg_catalog.to_jsonb(NEW);
  END IF;

  v_context_source := NULLIF(pg_catalog.current_setting('app.studio_course_edit_log_source', true), '');
  v_actor_text := NULLIF(pg_catalog.current_setting('app.studio_course_edit_log_actor', true), '');
  v_context_ref := NULLIF(pg_catalog.current_setting('app.studio_course_edit_log_ref', true), '');

  IF v_context_source IS NOT NULL THEN
    IF v_context_source NOT IN ('app_manual', 'studio_ai', 'studio_manual') THEN
      RAISE EXCEPTION USING
        MESSAGE = 'EDIT_LOG_FAILED: unsupported edit source',
        ERRCODE = '22023';
    END IF;

    v_source := v_context_source;
    IF v_actor_text IS NOT NULL THEN
      IF v_actor_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION USING
          MESSAGE = 'EDIT_LOG_FAILED: invalid actor identifier',
          ERRCODE = '22023';
      END IF;
      v_actor := v_actor_text::uuid;
    END IF;
    IF v_context_ref IS NOT NULL THEN
      v_source_ref := v_context_ref::jsonb;
    END IF;
  ELSE
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_source := 'app_manual';
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    v_course_id := COALESCE(v_new_row->>'id', v_old_row->>'id');
    IF v_course_id IS NULL THEN
      RETURN NULL;
    END IF;
    v_course_ids := ARRAY[v_course_id];
    v_entity := 'course';
    v_entity_id := v_course_id;
  ELSE
    IF NULLIF(v_old_row->>'course_id', '') IS NOT NULL THEN
      v_course_ids := pg_catalog.array_append(v_course_ids, v_old_row->>'course_id');
    END IF;
    IF NULLIF(v_new_row->>'course_id', '') IS NOT NULL
       AND NOT ((v_new_row->>'course_id') = ANY(v_course_ids)) THEN
      v_course_ids := pg_catalog.array_append(v_course_ids, v_new_row->>'course_id');
    END IF;

    CASE TG_TABLE_NAME
      WHEN 'course_sections' THEN
        v_entity := 'section';
        v_entity_id := COALESCE(v_new_row->>'id', v_old_row->>'id');
      WHEN 'course_lessons' THEN
        v_entity := 'lesson';
        v_entity_id := COALESCE(v_new_row->>'id', v_old_row->>'id');
      WHEN 'course_section_questions' THEN
        v_entity := 'question';
        v_entity_id := COALESCE(v_new_row->>'id', v_old_row->>'id');
      WHEN 'course_locales' THEN
        v_entity := 'locale';
        v_locale := COALESCE(v_new_row->>'locale', v_old_row->>'locale');
        v_entity_id := COALESCE(v_new_row->>'course_id', v_old_row->>'course_id') || ':' || v_locale;
      WHEN 'course_section_locales' THEN
        v_entity := 'locale';
        v_locale := COALESCE(v_new_row->>'locale', v_old_row->>'locale');
        v_entity_id := COALESCE(v_new_row->>'course_id', v_old_row->>'course_id')
          || ':' || COALESCE(v_new_row->>'section_id', v_old_row->>'section_id')
          || ':' || v_locale;
      WHEN 'course_lesson_locales' THEN
        v_entity := 'locale';
        v_locale := COALESCE(v_new_row->>'locale', v_old_row->>'locale');
        v_entity_id := COALESCE(v_new_row->>'course_id', v_old_row->>'course_id')
          || ':' || COALESCE(v_new_row->>'lesson_id', v_old_row->>'lesson_id')
          || ':' || v_locale;
      ELSE
        RETURN NULL;
    END CASE;
  END IF;

  IF pg_catalog.cardinality(v_course_ids) = 0 THEN
    RETURN NULL;
  END IF;

  FOREACH v_course_id IN ARRAY v_course_ids LOOP
    IF TG_TABLE_NAME = 'courses' THEN
      v_is_ai := COALESCE(v_old_row->'data'->>'course_type' = 'ai_generated', false)
        OR COALESCE(v_new_row->'data'->>'course_type' = 'ai_generated', false);
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = v_course_id
          AND c.data->>'course_type' = 'ai_generated'
      )
      INTO v_is_ai;
    END IF;

    IF v_is_ai THEN
      v_log_course_ids := pg_catalog.array_append(v_log_course_ids, v_course_id);
    END IF;
  END LOOP;

  IF pg_catalog.cardinality(v_log_course_ids) = 0 THEN
    RETURN NULL;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT NULLIF(pg_catalog.btrim(p.full_name), '')
    INTO v_actor_name
    FROM public.profiles p
    WHERE p.id = v_actor;
  END IF;

  v_old_data := COALESCE(v_old_row->'data', '{}'::jsonb);
  v_new_data := COALESCE(v_new_row->'data', '{}'::jsonb);
  IF TG_OP = 'DELETE' THEN
    v_label_data := v_old_data;
  ELSE
    v_label_data := v_new_data;
  END IF;

  FOR v_key IN
    SELECT keys.key
    FROM (
      SELECT key
      FROM pg_catalog.jsonb_each(v_old_row - 'data' - v_ignored_columns)
      UNION
      SELECT key
      FROM pg_catalog.jsonb_each(v_new_row - 'data' - v_ignored_columns)
    ) AS keys
    ORDER BY keys.key
  LOOP
    v_old_value := v_old_row->v_key;
    v_new_value := v_new_row->v_key;
    IF v_old_value IS DISTINCT FROM v_new_value THEN
      v_field_change := '{}'::jsonb;
      IF v_old_row ? v_key THEN
        v_field_change := v_field_change || pg_catalog.jsonb_build_object('old', v_old_value);
      END IF;
      IF v_new_row ? v_key THEN
        v_field_change := v_field_change || pg_catalog.jsonb_build_object('new', v_new_value);
      END IF;
      v_fields := v_fields || pg_catalog.jsonb_build_object(v_key, v_field_change);
    END IF;
  END LOOP;

  FOR v_key IN
    SELECT keys.key
    FROM (
      SELECT key
      FROM pg_catalog.jsonb_each(v_old_data - v_ignored_data_keys)
      UNION
      SELECT key
      FROM pg_catalog.jsonb_each(v_new_data - v_ignored_data_keys)
    ) AS keys
    ORDER BY keys.key
  LOOP
    v_old_value := CASE WHEN v_old_data ? v_key THEN v_old_data->v_key ELSE NULL END;
    v_new_value := CASE WHEN v_new_data ? v_key THEN v_new_data->v_key ELSE NULL END;
    IF v_old_value IS DISTINCT FROM v_new_value THEN
      v_field_change := '{}'::jsonb;
      IF v_old_data ? v_key THEN
        v_field_change := v_field_change || pg_catalog.jsonb_build_object('old', v_old_value);
      END IF;
      IF v_new_data ? v_key THEN
        v_field_change := v_field_change || pg_catalog.jsonb_build_object('new', v_new_value);
      END IF;
      v_fields := v_fields || pg_catalog.jsonb_build_object(v_key, v_field_change);
    END IF;
  END LOOP;

  IF v_fields = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'course_section_questions' THEN
    SELECT l.data INTO v_parent_data
    FROM public.course_lessons l
    WHERE l.course_id = COALESCE(v_new_row->>'course_id', v_old_row->>'course_id')
      AND l.id = COALESCE(v_new_row->>'lesson_id', v_old_row->>'lesson_id');
  ELSIF TG_TABLE_NAME IN ('course_locales', 'course_section_locales', 'course_lesson_locales') THEN
    IF TG_TABLE_NAME = 'course_locales' THEN
      SELECT c.data INTO v_parent_data
      FROM public.courses c
      WHERE c.id = COALESCE(v_new_row->>'course_id', v_old_row->>'course_id');
    ELSIF TG_TABLE_NAME = 'course_section_locales' THEN
      SELECT s.data INTO v_parent_data
      FROM public.course_sections s
      WHERE s.course_id = COALESCE(v_new_row->>'course_id', v_old_row->>'course_id')
        AND s.id = COALESCE(v_new_row->>'section_id', v_old_row->>'section_id');
    ELSE
      SELECT l.data INTO v_parent_data
      FROM public.course_lessons l
      WHERE l.course_id = COALESCE(v_new_row->>'course_id', v_old_row->>'course_id')
        AND l.id = COALESCE(v_new_row->>'lesson_id', v_old_row->>'lesson_id');
    END IF;
  END IF;

  v_label := COALESCE(
    v_label_data->>'title',
    v_label_data->>'name',
    v_label_data->>'question',
    v_label_data->>'prompt',
    v_old_data->>'title',
    v_new_data->>'title',
    v_old_data->>'name',
    v_new_data->>'name',
    v_old_data->>'question',
    v_new_data->>'question',
    v_parent_data->>'title',
    v_parent_data->>'name',
    v_entity_id
  );

  IF TG_TABLE_NAME = 'course_section_questions' AND v_parent_data IS NOT NULL THEN
    v_label := COALESCE(v_parent_data->>'title', v_parent_data->>'name', v_entity_id)
      || ' · ' || COALESCE(v_label, v_entity_id);
  END IF;

  IF v_entity = 'locale' AND v_locale IS NOT NULL THEN
    v_label := v_label || ' (' || v_locale || ')';
  END IF;

  v_txid := pg_catalog.txid_current();
  v_change := pg_catalog.jsonb_build_object(
    'entity', v_entity,
    'entity_id', v_entity_id,
    'label', v_label,
    'op', pg_catalog.lower(TG_OP),
    'fields', v_fields
  );

  FOREACH v_course_id IN ARRAY v_log_course_ids LOOP
    INSERT INTO public.studio_course_edits (
      course_id,
      txid,
      actor_id,
      actor_name,
      source,
      source_ref,
      changes
    )
    VALUES (
      v_course_id,
      v_txid,
      v_actor,
      v_actor_name,
      v_source,
      v_source_ref,
      pg_catalog.jsonb_build_array(v_change)
    )
    ON CONFLICT (txid, course_id)
    DO UPDATE SET changes = public.studio_course_edits.changes || EXCLUDED.changes;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_studio_course_edit()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_sections
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_section_questions
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_locales
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_section_locales
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();

CREATE TRIGGER studio_course_edits_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.course_lesson_locales
  FOR EACH ROW EXECUTE FUNCTION private.capture_studio_course_edit();
