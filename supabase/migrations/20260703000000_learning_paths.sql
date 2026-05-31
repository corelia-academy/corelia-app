-- Personalized AI-generated learning paths per user.
--
-- A row = one (user × goal). Each path contains a structured roadmap
-- mixing existing Corelia courses and career tracks, milestones, and a
-- weekly plan. Service role writes via the generate-learning-path edge
-- function; owners can read and delete their own paths.

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  user_level text,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  summary text,
  estimated_weeks int,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_courses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  weekly_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_paths_user_goal_uq UNIQUE (user_id, goal)
);

CREATE INDEX IF NOT EXISTS learning_paths_user_idx
  ON public.learning_paths (user_id, created_at DESC);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_owner_read
  ON public.learning_paths FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY lp_owner_delete
  ON public.learning_paths FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
