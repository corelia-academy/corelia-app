-- Manual ordering no longer requires an explanation from the operator.
ALTER TABLE public.studio_catalog_manual_orders
  ALTER COLUMN reason DROP NOT NULL;

ALTER TABLE public.studio_catalog_manual_orders
  DROP CONSTRAINT IF EXISTS studio_catalog_manual_orders_reason_check;

ALTER TABLE public.studio_catalog_manual_orders
  ADD CONSTRAINT studio_catalog_manual_orders_reason_check
  CHECK (reason IS NULL OR length(btrim(reason)) > 0);

-- Keep the existing four-argument signature; defaults let newer callers omit both optional fields.
CREATE OR REPLACE FUNCTION private.studio_set_manual_order(
  p_course_id uuid,
  p_position integer,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.studio_catalog_manual_orders
  SET status = 'superseded', ended_at = now()
  WHERE course_id = p_course_id AND status = 'active';

  INSERT INTO public.studio_catalog_manual_orders (course_id, position, reason, created_by)
  VALUES (p_course_id, p_position, NULLIF(btrim(p_reason), ''), p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.studio_set_manual_order(
  p_course_id uuid,
  p_position integer,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_set_manual_order(p_course_id, p_position, p_reason, p_actor);
$$;

-- Return and deactivate the currently active manual orders atomically. A supplied expected
-- snapshot is used by redo so it cannot erase a later order made by another administrator.
CREATE FUNCTION private.studio_clear_manual_orders(p_expected jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  -- Include concurrent inserts in the snapshot and keep later orders from being cleared unseen.
  LOCK TABLE public.studio_catalog_manual_orders IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('course_id', course_id, 'position', position, 'reason', reason)
      ORDER BY course_id
    ),
    '[]'::jsonb
  ) INTO v_snapshot
  FROM public.studio_catalog_manual_orders
  WHERE status = 'active';

  IF p_expected IS NOT NULL AND p_expected IS DISTINCT FROM v_snapshot THEN
    RAISE EXCEPTION 'manual_order_conflict' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_catalog_manual_orders
  SET status = 'superseded', ended_at = clock_timestamp()
  WHERE status = 'active';

  RETURN v_snapshot;
END;
$$;

CREATE FUNCTION public.studio_clear_manual_orders(p_expected jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_clear_manual_orders(p_expected);
$$;

-- Restore the pre-reset active set as new audit rows. The caller validates the full snapshot
-- against the current prerequisite graph before this RPC is allowed to write.
CREATE FUNCTION private.studio_restore_manual_orders(p_snapshot jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_course_id uuid;
  v_position integer;
  v_reason text;
  v_snapshot jsonb;
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'array' OR jsonb_array_length(p_snapshot) = 0 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'P0001';
  END IF;

  LOCK TABLE public.studio_catalog_manual_orders IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.studio_catalog_manual_orders WHERE status = 'active') THEN
    RAISE EXCEPTION 'manual_order_conflict' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_snapshot) AS entries(value) LOOP
    v_course_id := (v_item->>'course_id')::uuid;
    v_position := (v_item->>'position')::integer;
    v_reason := NULLIF(btrim(v_item->>'reason'), '');
    IF v_position IS NULL OR v_position < 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.studio_catalog_manual_orders
      WHERE course_id = v_course_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.studio_catalog_manual_orders (course_id, position, reason, created_by)
    VALUES (v_course_id, v_position, v_reason, p_actor);
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> (SELECT count(DISTINCT item->>'course_id') FROM jsonb_array_elements(p_snapshot) AS entries(item)) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('course_id', course_id, 'position', position, 'reason', reason)
      ORDER BY course_id
    ),
    '[]'::jsonb
  ) INTO v_snapshot
  FROM public.studio_catalog_manual_orders
  WHERE status = 'active';

  RETURN v_snapshot;
END;
$$;

CREATE FUNCTION public.studio_restore_manual_orders(p_snapshot jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_restore_manual_orders(p_snapshot, p_actor);
$$;

REVOKE ALL ON FUNCTION
  private.studio_set_manual_order(uuid, integer, text, uuid),
  public.studio_set_manual_order(uuid, integer, text, uuid),
  private.studio_clear_manual_orders(jsonb),
  public.studio_clear_manual_orders(jsonb),
  private.studio_restore_manual_orders(jsonb, uuid),
  public.studio_restore_manual_orders(jsonb, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  private.studio_set_manual_order(uuid, integer, text, uuid),
  public.studio_set_manual_order(uuid, integer, text, uuid),
  private.studio_clear_manual_orders(jsonb),
  public.studio_clear_manual_orders(jsonb),
  private.studio_restore_manual_orders(jsonb, uuid),
  public.studio_restore_manual_orders(jsonb, uuid)
TO service_role;
