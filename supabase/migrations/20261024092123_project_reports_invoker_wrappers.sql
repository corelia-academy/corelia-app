-- The Security Advisor rejects SECURITY DEFINER functions in the exposed
-- public schema. Follow the repository pattern (see list_trending_searches):
-- the privileged body lives in private as SECURITY DEFINER, and the public RPC
-- is a SECURITY INVOKER wrapper. Behavior and grants are unchanged.

CREATE OR REPLACE FUNCTION private.report_project_impl(p_project_id uuid, p_reason text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_reporters bigint;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501'; END IF;
  SELECT owner_id INTO v_owner FROM public.projects
  WHERE id = p_project_id AND NOT blocked AND visibility IN ('public','unlisted');
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF v_owner = v_actor THEN RAISE EXCEPTION 'invalid_input:project_report_self'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','sexual','violence','hate','illegal','plagiarism','other')
    OR char_length(COALESCE(p_note,'')) > 500 THEN
    RAISE EXCEPTION 'invalid_input:project_report';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-report:' || v_actor::text, 0));
  IF (SELECT count(*) FROM public.project_reports
      WHERE reporter_id = v_actor AND created_at > clock_timestamp() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'rate_limited:project_report';
  END IF;
  INSERT INTO public.project_reports(project_id,reporter_id,reason,note)
  VALUES (p_project_id, v_actor, p_reason, NULLIF(btrim(p_note),''))
  ON CONFLICT (project_id, reporter_id) WHERE status = 'open' DO NOTHING;

  SELECT count(*) INTO v_reporters FROM public.project_reports WHERE project_id = p_project_id AND status = 'open';
  PERFORM private.enqueue_project_moderation(p_project_id, LEAST(v_reporters, 10)::integer, 0);
END;
$$;
REVOKE ALL ON FUNCTION private.report_project_impl(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.report_project_impl(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.list_reported_projects_impl(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(
  project_id uuid, slug text, title text, visibility text, blocked boolean, owner_id uuid,
  source_id text, source_type text, open_reports bigint, reasons text[], latest_report_at timestamptz, notes text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF NOT private.is_admin_or_support() THEN RAISE EXCEPTION 'forbidden:project_reports' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.slug, p.title, p.visibility, p.blocked, p.owner_id, p.source_id, p.source_type,
    count(*), array_agg(DISTINCT r.reason), max(r.created_at),
    (array_agg(r.note ORDER BY r.created_at DESC) FILTER (WHERE r.note IS NOT NULL))[1:5]
  FROM public.project_reports r JOIN public.projects p ON p.id = r.project_id
  WHERE r.status = 'open'
  GROUP BY p.id
  ORDER BY count(*) DESC, max(r.created_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit,20), 100)) OFFSET GREATEST(COALESCE(p_offset,0),0);
END;
$$;
REVOKE ALL ON FUNCTION private.list_reported_projects_impl(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.list_reported_projects_impl(integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION private.resolve_project_reports_impl(p_project_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin_or_support() THEN RAISE EXCEPTION 'forbidden:project_reports' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('dismissed','actioned') THEN RAISE EXCEPTION 'invalid_input:project_report_status'; END IF;
  UPDATE public.project_reports SET status = p_status, resolved_at = clock_timestamp(), resolved_by = auth.uid()
  WHERE project_id = p_project_id AND status = 'open';
END;
$$;
REVOKE ALL ON FUNCTION private.resolve_project_reports_impl(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.resolve_project_reports_impl(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_project(p_project_id uuid, p_reason text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.report_project_impl(p_project_id, p_reason, p_note)
$$;

CREATE OR REPLACE FUNCTION public.list_reported_projects(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(
  project_id uuid, slug text, title text, visibility text, blocked boolean, owner_id uuid,
  source_id text, source_type text, open_reports bigint, reasons text[], latest_report_at timestamptz, notes text[]
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.list_reported_projects_impl(p_limit, p_offset)
$$;

CREATE OR REPLACE FUNCTION public.resolve_project_reports(p_project_id uuid, p_status text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.resolve_project_reports_impl(p_project_id, p_status)
$$;

REVOKE ALL ON FUNCTION public.report_project(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_reported_projects(integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_project_reports(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_project(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_reported_projects(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_project_reports(uuid,text) TO authenticated;
