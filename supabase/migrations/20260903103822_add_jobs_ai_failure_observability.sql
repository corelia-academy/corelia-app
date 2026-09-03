ALTER TABLE public.crawler_runs
  ADD COLUMN ai_failed_count integer NOT NULL DEFAULT 0
  CHECK (ai_failed_count >= 0);

COMMENT ON COLUMN public.crawler_runs.ai_failed_count IS
  'AI classification attempts that fell back to deterministic review because the provider failed or returned invalid output';
