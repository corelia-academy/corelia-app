-- Read-only audit of hackathon taxonomy state in live database.
-- Strictly mirrors the DB trigger contract in private.validate_hackathon_taxonomy.
-- Compatible with actual public.hackathons schema (id, status, document).

WITH audited_hackathons AS (
  SELECT
    id,
    COALESCE(document->>'slug', id::text) AS slug,
    COALESCE(document->>'title', 'Untitled') AS title,
    status,
    document,
    CASE
      WHEN document IS NULL OR jsonb_typeof(document) <> 'object' THEN 'document_not_object'
      WHEN document->'sectors' IS NULL OR jsonb_typeof(document->'sectors') <> 'array' THEN 'sectors_not_array'
      WHEN document->'tech_stacks' IS NULL OR jsonb_typeof(document->'tech_stacks') <> 'array' THEN 'tech_stacks_not_array'
      -- Check every sector item for structural & type validity
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(document->'sectors') s
        WHERE jsonb_typeof(s) <> 'object'
          OR jsonb_typeof(s->'id') IS DISTINCT FROM 'string'
          OR jsonb_typeof(s->'name') IS DISTINCT FROM 'string'
          OR COALESCE(btrim(s->>'id'), '') = ''
          OR COALESCE(btrim(s->>'name'), '') = ''
          OR (s ? 'active' AND jsonb_typeof(s->'active') <> 'boolean')
          OR (s ? 'sort_order' AND jsonb_typeof(s->'sort_order') <> 'number')
      ) THEN 'invalid_sector_item'
      -- Check every tech stack item for structural & type validity
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(document->'tech_stacks') t
        WHERE jsonb_typeof(t) <> 'object'
          OR jsonb_typeof(t->'id') IS DISTINCT FROM 'string'
          OR jsonb_typeof(t->'name') IS DISTINCT FROM 'string'
          OR COALESCE(btrim(t->>'id'), '') = ''
          OR COALESCE(btrim(t->>'name'), '') = ''
          OR (t ? 'active' AND jsonb_typeof(t->'active') <> 'boolean')
          OR (t ? 'sort_order' AND jsonb_typeof(t->'sort_order') <> 'number')
      ) THEN 'invalid_tech_stack_item'
      -- Must have at least one active sector
      WHEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(document->'sectors') s
        WHERE NOT (s ? 'active') OR (s->'active')::boolean = true
      ) THEN 'no_active_sectors'
      -- Must have at least one active tech stack
      WHEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(document->'tech_stacks') t
        WHERE NOT (t ? 'active') OR (t->'active')::boolean = true
      ) THEN 'no_active_tech_stacks'
      ELSE 'valid'
    END AS compliance_status
  FROM public.hackathons
  WHERE status IN ('published', 'running')
)
SELECT
  json_build_object(
    'total_published_running', count(*),
    'valid_count', count(*) FILTER (WHERE compliance_status = 'valid'),
    'violation_count', count(*) FILTER (WHERE compliance_status <> 'valid'),
    'violations', COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'slug', slug,
          'title', title,
          'status', status,
          'reason', compliance_status
        )
      ) FILTER (WHERE compliance_status <> 'valid'),
      '[]'::json
    )
  ) AS audit_result
FROM audited_hackathons;
