-- Blog and case-study articles for the landing site (corelia.academy/blog,
-- /case-studies), written in Admin → Blog instead of Markdown files in the repo.
--
-- The landing reads published rows through PostgREST with the publishable key, so
-- RLS is the visibility rule: anyone reads `published`, staff read and write all.
-- One row per language; rows sharing `translation_key` are translations of each other.
-- `category` and `tags` hold the keys from packages/ui/src/blog.ts.
-- Images uploaded from the editor go to the public `cdn` bucket under blog/.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL CHECK (locale IN ('vi','en')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 200),
  translation_key text NOT NULL CHECK (translation_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(translation_key) <= 200),
  content_type text NOT NULL DEFAULT 'blog' CHECK (content_type IN ('blog','case-study')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  author text CHECK (author IS NULL OR char_length(author) <= 100),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 100),
  tags text[] NOT NULL DEFAULT '{}',
  -- {"type":"image","src","alt"?,"fit"?,"ogSrc"?} or {"type":"youtube","url"}
  media jsonb CHECK (media IS NULL OR jsonb_typeof(media) = 'object'),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 200000),
  word_count integer GENERATED ALWAYS AS (
    COALESCE(array_length(regexp_split_to_array(NULLIF(btrim(body), ''), '\s+'), 1), 0)
  ) STORED,
  -- The date shown on the article and used for ordering.
  published_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT blog_posts_locale_slug_key UNIQUE (locale, slug),
  CONSTRAINT blog_posts_locale_translation_key UNIQUE (locale, translation_key)
);

CREATE INDEX IF NOT EXISTS blog_posts_published_listing
  ON public.blog_posts (locale, content_type, published_on DESC)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS trg_blog_posts_touch_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_touch_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated, service_role;

DROP POLICY IF EXISTS blog_posts_select_published ON public.blog_posts;
CREATE POLICY blog_posts_select_published ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS blog_posts_select_staff ON public.blog_posts;
CREATE POLICY blog_posts_select_staff ON public.blog_posts FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_support()));

DROP POLICY IF EXISTS blog_posts_insert_staff ON public.blog_posts;
CREATE POLICY blog_posts_insert_staff ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_support()));

DROP POLICY IF EXISTS blog_posts_update_staff ON public.blog_posts;
CREATE POLICY blog_posts_update_staff ON public.blog_posts FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_support()))
  WITH CHECK ((SELECT public.is_admin_or_support()));

DROP POLICY IF EXISTS blog_posts_delete_staff ON public.blog_posts;
CREATE POLICY blog_posts_delete_staff ON public.blog_posts FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_support()));

-- Editor image uploads: cdn/blog/{file}. Staff only; public delivery needs no policy.
DROP POLICY IF EXISTS cdn_blog_select ON storage.objects;
CREATE POLICY cdn_blog_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'blog'
    AND public.is_admin_or_support()
  );

DROP POLICY IF EXISTS cdn_blog_insert ON storage.objects;
CREATE POLICY cdn_blog_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'blog'
    AND public.is_admin_or_support()
  );

DROP POLICY IF EXISTS cdn_blog_delete ON storage.objects;
CREATE POLICY cdn_blog_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'blog'
    AND public.is_admin_or_support()
  );
