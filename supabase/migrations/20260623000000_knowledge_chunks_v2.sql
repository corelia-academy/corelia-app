ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_content_category_check;

ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_content_category_check
  CHECK (content_category IN (
    'lesson',
    'course_catalog',
    'career_track',
    'activity',
    'platform_guide',
    'credential'
  ));

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS chunk_kind text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

UPDATE public.knowledge_chunks
SET
  source_table = COALESCE(source_table, 'legacy'),
  source_id = COALESCE(NULLIF(source_id, ''), id::text),
  source_updated_at = COALESCE(source_updated_at, updated_at, created_at, now()),
  locale = COALESCE(locale, 'vi'),
  title = COALESCE(NULLIF(title, ''), topic),
  chunk_kind = COALESCE(NULLIF(chunk_kind, ''), 'legacy'),
  chunk_index = COALESCE(chunk_index, 0),
  checksum = COALESCE(
    NULLIF(checksum, ''),
    md5(
      COALESCE(topic, '') || '|' ||
      COALESCE(subtopic, '') || '|' ||
      COALESCE(content, '') || '|' ||
      COALESCE(content_category, '')
    )
  ),
  metadata = COALESCE(metadata, '{}'::jsonb)
WHERE
  source_table IS NULL OR
  source_id IS NULL OR source_id = '' OR
  source_updated_at IS NULL OR
  locale IS NULL OR
  title IS NULL OR title = '' OR
  chunk_kind IS NULL OR chunk_kind = '' OR
  chunk_index IS NULL OR
  checksum IS NULL OR checksum = '' OR
  metadata IS NULL;

ALTER TABLE public.knowledge_chunks
  ALTER COLUMN source_table SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL,
  ALTER COLUMN source_updated_at SET NOT NULL,
  ALTER COLUMN locale SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN chunk_kind SET NOT NULL,
  ALTER COLUMN chunk_index SET NOT NULL,
  ALTER COLUMN checksum SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

ALTER TABLE public.knowledge_chunks
  ALTER COLUMN locale SET DEFAULT 'vi',
  ALTER COLUMN chunk_index SET DEFAULT 0,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE public.knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_locale_check;

ALTER TABLE public.knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_locale_check
  CHECK (locale IN ('vi', 'en'));

DROP INDEX IF EXISTS public.knowledge_chunks_source_unique_idx;
CREATE UNIQUE INDEX knowledge_chunks_source_unique_idx
  ON public.knowledge_chunks (source_table, source_id, locale, chunk_kind, chunk_index);

CREATE INDEX IF NOT EXISTS knowledge_chunks_locale_category_idx
  ON public.knowledge_chunks (locale, content_category, source_updated_at DESC);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_count integer DEFAULT 5,
  filter_categories text[] DEFAULT NULL,
  preferred_locale text DEFAULT NULL,
  metadata_filter jsonb DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  topic text,
  subtopic text,
  content text,
  content_category text,
  track text,
  source_table text,
  source_id text,
  locale text,
  title text,
  chunk_kind text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id,
    kc.topic,
    kc.subtopic,
    kc.content,
    kc.content_category,
    kc.track,
    kc.source_table,
    kc.source_id,
    kc.locale,
    kc.title,
    kc.chunk_kind,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks AS kc
  WHERE kc.embedding IS NOT NULL
    AND (filter_categories IS NULL OR kc.content_category = ANY(filter_categories))
    AND (preferred_locale IS NULL OR kc.locale = preferred_locale)
    AND (metadata_filter IS NULL OR kc.metadata @> metadata_filter)
  ORDER BY kc.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(extensions.vector, integer, text[], text, jsonb)
  TO authenticated;
