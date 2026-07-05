-- Fix public search RPC to not exclude private profiles completely.
-- Private profiles are already scrubbed of sensitive data in public.public_profiles by triggers,
-- so they should still be discoverable by their name/username/ocid.

CREATE OR REPLACE FUNCTION public.search_public(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  href text,
  rank numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_has_public_profiles boolean := (to_regclass('public.public_profiles') IS NOT NULL);
  v_sql text;
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  v_sql := $SQL$
    WITH q AS (
      SELECT $1::text AS query
    ),
    projects_res AS (
      SELECT
        'project'::text AS entity_type,
        p.id::text AS entity_id,
        p.title AS title,
        NULL::text AS subtitle,
        '/projects'::text AS href,
        (similarity(lower(p.title), q.query) + CASE WHEN lower(p.title) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.projects p, q
      WHERE p.visibility = 'public'
        AND (lower(p.title) LIKE ('%' || q.query || '%') OR lower(coalesce(p.summary, '')) LIKE ('%' || q.query || '%'))
    ),
    hackathons_res AS (
      SELECT
        'hackathon'::text AS entity_type,
        h.id::text AS entity_id,
        coalesce(nullif(h.document->>'title',''), h.id)::text AS title,
        nullif(h.document->>'tagline','')::text AS subtitle,
        ('/hackathons/' || h.id || '/overview')::text AS href,
        (similarity(lower(coalesce(h.document->>'title','')), q.query)
          + CASE WHEN lower(coalesce(h.document->>'title','')) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        h.updated_at AS updated_at
      FROM public.hackathons h, q
      WHERE h.status IN ('published','running','ended')
        AND (
          lower(coalesce(h.document->>'title','')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(h.document->>'tagline','')) LIKE ('%' || q.query || '%')
        )
    ),
    courses_res AS (
      SELECT
        'course'::text AS entity_type,
        co.id::text AS entity_id,
        coalesce(nullif(co.data->>'title',''), co.id)::text AS title,
        nullif(co.data->>'tagline','')::text AS subtitle,
        ('/courses/' || co.id)::text AS href,
        (similarity(lower(coalesce(co.data->>'title','')), q.query)
          + CASE WHEN lower(coalesce(co.data->>'title','')) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        co.updated_at AS updated_at
      FROM public.courses co, q
      WHERE co.published = true
        AND (
          lower(coalesce(co.data->>'title','')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(co.slug,'')) LIKE ('%' || q.query || '%')
        )
    ),
    career_tracks_res AS (
      SELECT
        'career_track'::text AS entity_type,
        t.id::text AS entity_id,
        t.title AS title,
        t.description AS subtitle,
        (
          CASE
            WHEN t.owner_scope = 'instructor' AND t.instructor_id IS NOT NULL THEN
              '/career/' ||
              coalesce(nullif(pp.username,''), nullif(pp.ocid,''), t.instructor_id::text) ||
              '/' || t.slug
            ELSE
              '/career/corelia/' || t.slug
          END
        )::text AS href,
        (similarity(lower(t.title), q.query) + CASE WHEN lower(t.title) LIKE (q.query || '%') THEN 1 ELSE 0 END)::numeric AS rank,
        t.updated_at AS updated_at
      FROM public.career_tracks t
      LEFT JOIN public.public_profiles pp ON pp.id = t.instructor_id,
      q
      WHERE t.published = true
        AND (
          lower(t.title) LIKE ('%' || q.query || '%')
          OR lower(t.description) LIKE ('%' || q.query || '%')
        )
    )
  $SQL$;

  IF v_has_public_profiles THEN
    v_sql := v_sql || $SQL$
    ,
    profiles_res AS (
      SELECT
        'profile'::text AS entity_type,
        p.id::text AS entity_id,
        coalesce(nullif(p.full_name,''), nullif(p.username,''), nullif(p.ocid,''), p.id::text)::text AS title,
        coalesce(nullif(p.username,''), nullif(p.ocid,''))::text AS subtitle,
        ('/u/' || coalesce(nullif(p.username,''), nullif(p.ocid,''), p.id::text))::text AS href,
        (greatest(
          similarity(lower(coalesce(p.username,'')), q.query),
          similarity(lower(coalesce(p.ocid,'')), q.query),
          similarity(lower(coalesce(p.full_name,'')), q.query)
        )
        + CASE
            WHEN lower(coalesce(p.username,'')) LIKE (q.query || '%') THEN 1
            WHEN lower(coalesce(p.ocid,'')) LIKE (q.query || '%') THEN 1
            WHEN lower(coalesce(p.full_name,'')) LIKE (q.query || '%') THEN 1
            ELSE 0
          END
        )::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.public_profiles p, q
      WHERE (
          lower(coalesce(p.username,'')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(p.ocid,'')) LIKE ('%' || q.query || '%')
          OR lower(coalesce(p.full_name,'')) LIKE ('%' || q.query || '%')
        )
    )
    $SQL$;
  END IF;

  v_sql := v_sql || $SQL$
    ,
    unioned AS (
      SELECT * FROM projects_res
      UNION ALL SELECT * FROM hackathons_res
      UNION ALL SELECT * FROM courses_res
      UNION ALL SELECT * FROM career_tracks_res
  $SQL$;

  IF v_has_public_profiles THEN
    v_sql := v_sql || $SQL$
      UNION ALL SELECT * FROM profiles_res
    $SQL$;
  END IF;

  v_sql := v_sql || $SQL$
    )
    SELECT
      u.entity_type,
      u.entity_id,
      u.title,
      u.subtitle,
      u.href,
      u.rank
    FROM unioned u
    ORDER BY u.rank DESC, u.updated_at DESC
    LIMIT $2 OFFSET $3
  $SQL$;

  RETURN QUERY EXECUTE v_sql USING v_query, v_limit, v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public(text, int, int) TO anon, authenticated;
