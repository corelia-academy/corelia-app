-- Studio generations: per-lesson model calls.
--
-- Steps that fan out over lessons (lessons, lesson_review) need one generation row per
-- lesson and attempt. lesson_id is NULL for steps that run once per run; NULLS NOT DISTINCT
-- keeps the claim for those steps exactly as before: two ticks inserting the same
-- (run, step, attempt) still collide on 23505.

ALTER TABLE public.studio_generations ADD COLUMN lesson_id text;

ALTER TABLE public.studio_generations DROP CONSTRAINT studio_generations_attempt_key;
ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_attempt_key
  UNIQUE NULLS NOT DISTINCT (run_id, step_key, lesson_id, attempt);
