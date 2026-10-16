-- Search QA fixes (staging manual test):
-- * Accent-insensitive matching so "khoa hoc", "khoá học" and "khóa học"
--   all find the same Vietnamese titles.
-- * Escape LIKE wildcards so "%" / "_" match literally instead of every row.
-- * Project results link to the project detail page instead of /projects.
-- Signature, return shape, SECURITY INVOKER and grants are unchanged.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

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
  v_query text := lower(extensions.unaccent(trim(coalesce(p_query, ''))));
  v_pattern text;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_has_public_profiles boolean := (to_regclass('public.public_profiles') IS NOT NULL);
  v_sql text;
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  v_pattern := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');

  v_sql := $SQL$
    WITH q AS (
      SELECT $1::text AS query, $4::text AS pattern
    ),
    projects_res AS (
      SELECT
        'project'::text AS entity_type,
        p.id::text AS entity_id,
        p.title AS title,
        NULL::text AS subtitle,
        ('/projects/' || p.slug)::text AS href,
        (similarity(lower(extensions.unaccent(p.title)), q.query)
          + CASE WHEN lower(extensions.unaccent(p.title)) LIKE (q.pattern || '%') ESCAPE '\' THEN 1 ELSE 0 END)::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.projects p, q
      WHERE p.visibility = 'public'
        AND (
          lower(extensions.unaccent(p.title)) LIKE ('%' || q.pattern || '%') ESCAPE '\'
          OR lower(extensions.unaccent(coalesce(p.summary, ''))) LIKE ('%' || q.pattern || '%') ESCAPE '\'
        )
    ),
    hackathons_res AS (
      SELECT
        'hackathon'::text AS entity_type,
        h.id::text AS entity_id,
        coalesce(nullif(h.document->>'title',''), h.id)::text AS title,
        nullif(h.document->>'tagline','')::text AS subtitle,
        ('/hackathons/' || h.id || '/overview')::text AS href,
        (similarity(lower(extensions.unaccent(coalesce(h.document->>'title',''))), q.query)
          + CASE WHEN lower(extensions.unaccent(coalesce(h.document->>'title',''))) LIKE (q.pattern || '%') ESCAPE '\' THEN 1 ELSE 0 END)::numeric AS rank,
        h.updated_at AS updated_at
      FROM public.hackathons h, q
      WHERE h.status IN ('published','running','ended')
        AND (
          lower(extensions.unaccent(coalesce(h.document->>'title',''))) LIKE ('%' || q.pattern || '%') ESCAPE '\'
          OR lower(extensions.unaccent(coalesce(h.document->>'tagline',''))) LIKE ('%' || q.pattern || '%') ESCAPE '\'
        )
    ),
    courses_res AS (
      SELECT
        'course'::text AS entity_type,
        co.id::text AS entity_id,
        coalesce(nullif(co.data->>'title',''), co.id)::text AS title,
        nullif(co.data->>'tagline','')::text AS subtitle,
        ('/courses/' || co.id)::text AS href,
        (similarity(lower(extensions.unaccent(coalesce(co.data->>'title',''))), q.query)
          + CASE WHEN lower(extensions.unaccent(coalesce(co.data->>'title',''))) LIKE (q.pattern || '%') ESCAPE '\' THEN 1 ELSE 0 END)::numeric AS rank,
        co.updated_at AS updated_at
      FROM public.courses co, q
      WHERE co.published = true
        AND (
          lower(extensions.unaccent(coalesce(co.data->>'title',''))) LIKE ('%' || q.pattern || '%') ESCAPE '\'
          OR lower(coalesce(co.slug,'')) LIKE ('%' || q.pattern || '%') ESCAPE '\'
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
          similarity(lower(extensions.unaccent(coalesce(p.full_name,''))), q.query)
        )
        + CASE
            WHEN lower(coalesce(p.username,'')) LIKE (q.pattern || '%') ESCAPE '\' THEN 1
            WHEN lower(coalesce(p.ocid,'')) LIKE (q.pattern || '%') ESCAPE '\' THEN 1
            WHEN lower(extensions.unaccent(coalesce(p.full_name,''))) LIKE (q.pattern || '%') ESCAPE '\' THEN 1
            ELSE 0
          END
        )::numeric AS rank,
        p.updated_at AS updated_at
      FROM public.public_profiles p, q
      WHERE p.profile_public = true
        AND (
          lower(coalesce(p.username,'')) LIKE ('%' || q.pattern || '%') ESCAPE '\'
          OR lower(coalesce(p.ocid,'')) LIKE ('%' || q.pattern || '%') ESCAPE '\'
          OR lower(extensions.unaccent(coalesce(p.full_name,''))) LIKE ('%' || q.pattern || '%') ESCAPE '\'
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

  RETURN QUERY EXECUTE v_sql USING v_query, v_limit, v_offset, v_pattern;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public(text, int, int) TO anon, authenticated;
