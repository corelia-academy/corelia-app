-- Corelia Studio: activity log of a generation run (sidebar "what the agent is doing").
--
-- Model
--   studio_run_events  append-only lines emitted while a run executes, per step and
--                      per attempt. Short status lines written by the orchestrator at
--                      known points (step start/end, tool call, model call, review),
--                      not raw model reasoning.
--                        kind = progress  live status line
--                               result    step summary (+ optional structured payload)
--                               warning   non-blocking issue
--                               error     failure of the step/attempt
--                      Whether a progress line is finished is derived on read (a later
--                      line exists in the same step, or the step is done); rows are
--                      never updated.
--                      attempt separates retries of the same step so a re-run does not
--                      look like duplicated lines.
--                      Full generated content belongs to the future `generation` table;
--                      a link column is added when that table exists.
--
-- Authorization
--   Read: admin only, same gate as the other studio_* tables (studio_can_write()).
--   Write: no policy and no grant for anon/authenticated. Lines are written by the
--   orchestrator with the service role (bypasses RLS), so a browser client cannot
--   forge, edit or delete the log.
--
-- Realtime
--   Added to supabase_realtime so the Studio sidebar receives new lines; postgres_changes
--   delivery is filtered by the SELECT policy.

CREATE TABLE public.studio_run_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL,
  step_key text NOT NULL,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  kind text NOT NULL CHECK (kind IN ('progress', 'result', 'warning', 'error')),
  agent_role text CHECK (agent_role IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6')),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 500),
  payload jsonb CHECK (payload IS NULL OR (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 16384)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_run_events_step_fkey
    FOREIGN KEY (run_id, step_key) REFERENCES public.studio_run_steps (run_id, step_key) ON DELETE CASCADE
);

CREATE INDEX studio_run_events_run_id_idx ON public.studio_run_events (run_id, id);

ALTER TABLE public.studio_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY studio_run_events_admin_read ON public.studio_run_events
  FOR SELECT TO authenticated USING ((SELECT public.studio_can_write()));

REVOKE ALL ON public.studio_run_events FROM anon, authenticated;
GRANT SELECT ON public.studio_run_events TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'studio_run_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_run_events;
  END IF;
END $$;
