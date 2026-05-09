-- Enforce unique hackathon slug (case-insensitive) stored in hackathons.document.slug
-- Slug is used for canonical public routes: /hackathons/:slug/...

BEGIN;

-- Unique, case-insensitive slug. Ignore null/empty.
CREATE UNIQUE INDEX IF NOT EXISTS hackathons_document_slug_unique
  ON public.hackathons ((lower((document->>'slug'))))
  WHERE coalesce(document->>'slug', '') <> '';

COMMIT;

