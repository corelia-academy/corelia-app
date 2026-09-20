-- Keep Email Center template mutations atomic. These RPCs are backend-only;
-- browser roles continue to use the authenticated Edge Function boundary.
CREATE OR REPLACE FUNCTION public.email_save_template_draft(
  p_template_id uuid,
  p_name text,
  p_purpose text,
  p_description text,
  p_localized_content jsonb,
  p_compatibility jsonb,
  p_variables text[],
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version integer;
  v_version_id uuid;
BEGIN
  IF p_purpose NOT IN ('system', 'learning', 'event', 'marketing')
     OR nullif(btrim(p_name), '') IS NULL
     OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'invalid_template_input' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_template_id::text, 0));

  INSERT INTO public.email_templates(id, name, purpose, description, created_by)
  VALUES (p_template_id, btrim(p_name), p_purpose, nullif(btrim(p_description), ''), p_actor_id)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        purpose = EXCLUDED.purpose,
        description = EXCLUDED.description,
        updated_at = now();

  SELECT version, id
    INTO v_version, v_version_id
    FROM public.email_template_versions
   WHERE template_id = p_template_id AND status = 'draft'
   FOR UPDATE;

  IF v_version_id IS NULL THEN
    SELECT coalesce(max(version), 0) + 1
      INTO v_version
      FROM public.email_template_versions
     WHERE template_id = p_template_id;

    INSERT INTO public.email_template_versions(
      template_id, version, subject, preheader, body_text, cta_label, cta_url,
      image_url, localized_content, variables, created_by
    )
    VALUES (
      p_template_id, v_version, p_compatibility->>'subject',
      coalesce(p_compatibility->>'preheader', ''),
      p_compatibility->>'body_text', nullif(p_compatibility->>'cta_label', ''),
      nullif(p_compatibility->>'cta_url', ''), nullif(p_compatibility->>'image_url', ''),
      p_localized_content, coalesce(p_variables, ARRAY[]::text[]), p_actor_id
    )
    RETURNING id INTO v_version_id;
  ELSE
    UPDATE public.email_template_versions
       SET subject = p_compatibility->>'subject',
           preheader = coalesce(p_compatibility->>'preheader', ''),
           body_text = p_compatibility->>'body_text',
           cta_label = nullif(p_compatibility->>'cta_label', ''),
           cta_url = nullif(p_compatibility->>'cta_url', ''),
           image_url = nullif(p_compatibility->>'image_url', ''),
           localized_content = p_localized_content,
           variables = coalesce(p_variables, ARRAY[]::text[])
     WHERE id = v_version_id;
  END IF;

  RETURN jsonb_build_object('id', p_template_id, 'version_id', v_version_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.email_publish_template_version(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT template_id INTO v_template_id
    FROM public.email_template_versions
   WHERE id = p_version_id AND status = 'draft'
   FOR UPDATE;
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'template_version_not_draft' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_template_id::text, 0));
  UPDATE public.email_template_versions
     SET status = 'archived'
   WHERE template_id = v_template_id AND status = 'published';
  UPDATE public.email_template_versions
     SET status = 'published', published_at = now()
   WHERE id = p_version_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template_version_not_draft' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('id', p_version_id, 'template_id', v_template_id);
END;
$$;

REVOKE ALL ON FUNCTION public.email_save_template_draft(uuid,text,text,text,jsonb,jsonb,text[],uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_publish_template_version(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_save_template_draft(uuid,text,text,text,jsonb,jsonb,text[],uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_publish_template_version(uuid) TO service_role;
