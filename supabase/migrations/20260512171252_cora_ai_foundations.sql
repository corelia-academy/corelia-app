CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  context_type text NOT NULL
    CHECK (context_type IN (
      'dashboard',
      'course_discovery',
      'career',
      'activity',
      'profile_review',
      'global'
    )),
  title text,
  message_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_idx
  ON public.ai_chat_sessions (user_id, context_type, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id text,
  session_id uuid REFERENCES public.ai_chat_sessions (id) ON DELETE CASCADE,
  context_type text NOT NULL DEFAULT 'lesson'
    CHECK (context_type IN (
      'lesson',
      'dashboard',
      'course_discovery',
      'career',
      'activity',
      'profile_review',
      'global'
    )),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'error')),
  model_used text,
  complexity text,
  tokens_used int NOT NULL DEFAULT 0,
  cached boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (lesson_id IS NOT NULL AND session_id IS NULL) OR
    (lesson_id IS NULL AND session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ai_conversations_lesson_idx
  ON public.ai_conversations (user_id, lesson_id, created_at DESC)
  WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_session_idx
  ON public.ai_conversations (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_pending_idx
  ON public.ai_conversations (user_id, status, created_at DESC)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  message_count int NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month text NOT NULL,
  message_count int NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS public.tier_limits (
  tier text PRIMARY KEY CHECK (tier IN ('free', 'student', 'pro', 'bootcamp')),
  monthly_messages int,
  rolling_3h_soft_cap int,
  haiku_only boolean NOT NULL DEFAULT true,
  price_vnd_monthly int,
  label_vi text,
  label_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tier_limits (
  tier,
  monthly_messages,
  rolling_3h_soft_cap,
  haiku_only,
  price_vnd_monthly,
  label_vi,
  label_en
)
VALUES
  ('free', 6, 40, 6, true, 0, 'Miễn phí', 'Free'),
  ('student', 20, 250, 20, true, 99000, 'Học viên', 'Student'),
  ('pro', 50, 700, 50, false, 199000, 'Pro', 'Pro'),
  ('bootcamp', 120, 1800, 120, false, 499000, 'Bootcamp', 'Bootcamp')
ON CONFLICT (tier) DO UPDATE
SET
  monthly_messages = EXCLUDED.monthly_messages,
  rolling_3h_soft_cap = EXCLUDED.rolling_3h_soft_cap,
  haiku_only = EXCLUDED.haiku_only,
  price_vnd_monthly = EXCLUDED.price_vnd_monthly,
  label_vi = EXCLUDED.label_vi,
  label_en = EXCLUDED.label_en,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  subtopic text,
  content text NOT NULL,
  embedding extensions.vector(1536),
  source text NOT NULL DEFAULT 'corelia',
  track text,
  content_category text NOT NULL DEFAULT 'lesson'
    CHECK (content_category IN (
      'lesson',
      'course_catalog',
      'career_track',
      'activity',
      'platform_guide'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_category_idx
  ON public.knowledge_chunks (content_category, created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_embedding_idx
  ON public.knowledge_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS public.user_learning_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  weak_topics text[] NOT NULL DEFAULT '{}',
  strong_topics text[] NOT NULL DEFAULT '{}',
  common_mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_style text,
  ai_summary text,
  total_questions int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id text,
  session_id uuid REFERENCES public.ai_chat_sessions (id) ON DELETE CASCADE,
  topic text,
  observation text,
  insight text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('student', 'pro', 'bootcamp')),
  duration_months int NOT NULL CHECK (duration_months IN (1, 6, 12)),
  price_vnd int NOT NULL,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payment_transaction_id text NOT NULL REFERENCES public.payment_transactions (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_subscriptions_user_idx
  ON public.ai_subscriptions (user_id, status, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ai_subscriptions_one_active_per_user
  ON public.ai_subscriptions (user_id)
  WHERE status = 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free'
    CHECK (tier IN ('free', 'student', 'pro', 'bootcamp')),
  ADD COLUMN IF NOT EXISTS user_level text DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS track_interest text,
  ADD COLUMN IF NOT EXISTS category_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS user_goal text,
  ADD COLUMN IF NOT EXISTS streak_days int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_fingerprint jsonb;

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_sessions ON public.ai_chat_sessions;
CREATE POLICY own_sessions
  ON public.ai_chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_conversations ON public.ai_conversations;
CREATE POLICY own_conversations
  ON public.ai_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_ai_usage_daily ON public.ai_usage_daily;
CREATE POLICY own_ai_usage_daily
  ON public.ai_usage_daily FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_ai_usage_monthly ON public.ai_usage_monthly;
CREATE POLICY own_ai_usage_monthly
  ON public.ai_usage_monthly FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS knowledge_public_read ON public.knowledge_chunks;
CREATE POLICY knowledge_public_read
  ON public.knowledge_chunks FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS own_learning_profile ON public.user_learning_profile;
CREATE POLICY own_learning_profile
  ON public.user_learning_profile FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_learning_observations ON public.learning_observations;
CREATE POLICY own_learning_observations
  ON public.learning_observations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS own_ai_subscriptions ON public.ai_subscriptions;
CREATE POLICY own_ai_subscriptions
  ON public.ai_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
