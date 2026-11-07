-- Target translation locales of one Studio run. The default is every locale Studio translates into, so
-- existing runs and runs started without a choice behave as before; a run may narrow it before the
-- translate step starts (English stays the source and is always published).

ALTER TABLE public.studio_runs
  ADD COLUMN translation_locales text[] NOT NULL
    DEFAULT ARRAY['zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja']::text[];

ALTER TABLE public.studio_runs
  ADD CONSTRAINT studio_runs_translation_locales_valid
  CHECK (
    cardinality(translation_locales) > 0
    AND translation_locales <@ ARRAY['zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja']::text[]
  );
