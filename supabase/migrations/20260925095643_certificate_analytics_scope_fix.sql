-- Keep completion cohorts limited to courses that award Corelia certificates or OCA credentials.
CREATE OR REPLACE FUNCTION private.admin_certificate_analytics(
  p_course text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_network text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_network IS NOT NULL AND p_network NOT IN ('staging', 'mainnet') THEN
    RAISE EXCEPTION 'INVALID_NETWORK';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;
  IF p_offset < 0 OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_PAGE';
  END IF;

  WITH pairs AS (
    SELECT user_id, course_id FROM public.enrollments
      WHERE course_id IS NOT NULL AND (p_course IS NULL OR course_id = p_course)
        AND (completed_at IS NOT NULL OR certificate_issued_at IS NOT NULL)
        AND (
          EXISTS (
            SELECT 1 FROM public.courses course
            WHERE course.id = enrollments.course_id
              AND (course.data->>'has_certificate' = 'true'
                OR NULLIF(btrim(course.data->>'certificate_template_url'), '') IS NOT NULL)
          )
          OR EXISTS (
            SELECT 1 FROM public.credential_templates template
            WHERE template.course_id = enrollments.course_id
              AND template.scope_type = 'course' AND template.collection_symbol IS NULL
          )
        )
    UNION
    SELECT user_id, course_id FROM public.certificate_records
      WHERE course_id IS NOT NULL AND (p_course IS NULL OR course_id = p_course)
    UNION
    SELECT ci.user_id, ci.course_id FROM public.credential_issuances ci
      JOIN public.credential_templates ct ON ct.id = ci.template_id
      WHERE ci.course_id IS NOT NULL AND (p_course IS NULL OR ci.course_id = p_course)
        AND ct.scope_type = 'course' AND ct.collection_symbol IS NULL
  ), facts AS (
    SELECT pair.user_id, pair.course_id,
      COALESCE(cr.issued_at, e.completed_at, oc.minted_at, oc.created_at) AS anchor_at,
      e.completed_at, cr.id AS certificate_id, cr.code, cr.issued_at, cr.revoked_at,
      COALESCE(cr.holder_name, pr.full_name, au.email, pair.user_id::text) AS learner_name,
      COALESCE(pr.email, au.email) AS learner_email,
      COALESCE(c.data->>'title', cr.course_title, pair.course_id) AS course_title,
      oc.id AS issuance_id, oc.network, oc.status AS oc_status,
      oc.oc_credential_id, oc.minted_at, oc.error_message,
      core_mail.provider_status AS core_email,
      oc_mail.provider_status AS oc_email,
      EXISTS (
        SELECT 1 FROM public.user_notifications n
        WHERE n.user_id = pair.user_id AND n.type = 'course_certificate_issued'
          AND n.payload->>'course_id' = pair.course_id
      ) AS core_notification,
      EXISTS (
        SELECT 1 FROM public.user_notifications n
        WHERE n.user_id = pair.user_id AND n.type = 'oc_credential_minted'
          AND (n.payload->>'issuance_id' = oc.id::text
            OR (oc.oc_credential_id IS NOT NULL AND n.payload->>'oc_credential_id' = oc.oc_credential_id))
      ) AS oc_notification
    FROM pairs pair
    LEFT JOIN public.enrollments e ON e.user_id = pair.user_id AND e.course_id = pair.course_id
    LEFT JOIN public.certificate_records cr ON cr.user_id = pair.user_id AND cr.course_id = pair.course_id
    LEFT JOIN public.profiles pr ON pr.id = pair.user_id
    LEFT JOIN auth.users au ON au.id = pair.user_id
    LEFT JOIN public.courses c ON c.id = pair.course_id
    LEFT JOIN LATERAL (
      SELECT ci.* FROM public.credential_issuances ci
      JOIN public.credential_templates ct ON ct.id = ci.template_id
      WHERE ci.user_id = pair.user_id AND ci.course_id = pair.course_id
        AND ct.scope_type = 'course' AND ct.collection_symbol IS NULL
        AND (p_network IS NULL OR ci.network = p_network)
      ORDER BY CASE
        WHEN ci.status = 'minted' AND ci.oc_credential_id IS NOT NULL THEN 0
        WHEN ci.status = 'minted' THEN 1
        WHEN ci.status = 'pending' THEN 2 ELSE 3 END,
        CASE WHEN ci.network = 'mainnet' THEN 0 ELSE 1 END,
        ci.created_at DESC, ci.id DESC
      LIMIT 1
    ) oc ON true
    LEFT JOIN LATERAL (
      SELECT a.provider_status FROM public.email_delivery_attempts a
      WHERE a.context_type = 'corelia_certificate' AND a.context_id = cr.id
        AND a.mail_type = 'certificate_issued'
      ORDER BY a.created_at DESC, a.id DESC LIMIT 1
    ) core_mail ON true
    LEFT JOIN LATERAL (
      SELECT a.provider_status FROM public.email_delivery_attempts a
      WHERE a.context_type = 'oc_issuance' AND a.context_id = oc.id
        AND a.mail_type = 'credential_minted'
      ORDER BY a.created_at DESC, a.id DESC LIMIT 1
    ) oc_mail ON true
  ), filtered AS (
    SELECT * FROM facts f WHERE (p_course IS NULL OR f.course_id = p_course)
      AND (p_from IS NULL OR (f.anchor_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= p_from)
      AND (p_to IS NULL OR (f.anchor_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_to)
      AND (p_network IS NULL OR f.issuance_id IS NOT NULL)
  ), page AS (
    SELECT * FROM filtered ORDER BY anchor_at DESC NULLS LAST, course_id, user_id
    OFFSET p_offset LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'summary', (SELECT jsonb_build_object(
      'completed', count(*) FILTER (WHERE completed_at IS NOT NULL),
      'corelia_issued', count(*) FILTER (WHERE certificate_id IS NOT NULL AND revoked_at IS NULL),
      'corelia_revoked', count(*) FILTER (WHERE revoked_at IS NOT NULL),
      'oca_minted', count(*) FILTER (WHERE oc_status = 'minted' AND oc_credential_id IS NOT NULL),
      'oca_unresolved', count(*) FILTER (WHERE oc_status = 'minted' AND oc_credential_id IS NULL),
      'oca_pending', count(*) FILTER (WHERE oc_status = 'pending'),
      'oca_failed', count(*) FILTER (WHERE oc_status = 'failed'),
      'unique_learners', count(DISTINCT user_id)
    ) FROM filtered),
    'mint_attempts_logged', (
      SELECT count(*) FROM public.credential_mint_attempts a
      JOIN public.credential_issuances ci ON ci.id = a.issuance_id
      JOIN public.credential_templates ct ON ct.id = ci.template_id
      WHERE EXISTS (SELECT 1 FROM filtered f WHERE f.user_id = ci.user_id AND f.course_id = ci.course_id)
        AND ct.scope_type = 'course' AND ct.collection_symbol IS NULL
        AND (p_network IS NULL OR ci.network = p_network)
        AND (p_from IS NULL OR (a.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= p_from)
        AND (p_to IS NULL OR (a.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_to)
    ),
    'courses', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'title', COALESCE(c.data->>'title', c.id)) ORDER BY c.data->>'title', c.id), '[]'::jsonb)
      FROM public.courses c WHERE EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.certificate_issued_at IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.credential_templates ct WHERE ct.course_id = c.id AND ct.scope_type = 'course' AND ct.collection_symbol IS NULL)),
    'rows', (SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY anchor_at DESC NULLS LAST, course_id, user_id), '[]'::jsonb) FROM page)
  ) INTO v_result;
  RETURN v_result;
END $$;
