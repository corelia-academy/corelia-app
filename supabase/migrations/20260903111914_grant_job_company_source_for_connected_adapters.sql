BEGIN;

-- PostgREST needs the direct foreign-key column to resolve the public
-- job_sources -> job_companies embed used by the connected-adapters footer.
-- The column only identifies the already-public source record; RLS continues
-- to restrict rows to active, verified employers.
GRANT SELECT (source_id) ON public.job_companies TO anon, authenticated;

COMMIT;
