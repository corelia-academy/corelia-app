-- Backfill hackathon slugs for existing rows (used by /hackathons/:slug/* routes)
-- Strategy: slugify title + suffix with short id to guarantee uniqueness.

BEGIN;

UPDATE public.hackathons h
SET document = jsonb_set(
  coalesce(h.document, '{}'::jsonb),
  '{slug}',
  to_jsonb(
    CASE
      WHEN coalesce(h.document->>'title', '') <> '' THEN
        regexp_replace(
          regexp_replace(
            lower(h.document->>'title') || '-' || left(h.id::text, 8),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '(^-+|-+$)',
          '',
          'g'
        )
      ELSE
        'hackathon-' || left(h.id::text, 8)
    END
  ),
  true
)
WHERE coalesce(h.document->>'slug', '') = '';

COMMIT;

