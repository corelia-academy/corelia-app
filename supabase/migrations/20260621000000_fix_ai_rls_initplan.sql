-- Fix auth_rls_initplan: wrap auth function calls in (select ...) to prevent per-row re-evaluation

-- ai_chat_sessions
DROP POLICY IF EXISTS own_sessions ON public.ai_chat_sessions;
CREATE POLICY own_sessions
  ON public.ai_chat_sessions FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ai_conversations
DROP POLICY IF EXISTS own_conversations ON public.ai_conversations;
CREATE POLICY own_conversations
  ON public.ai_conversations FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ai_usage_daily
DROP POLICY IF EXISTS own_ai_usage_daily ON public.ai_usage_daily;
CREATE POLICY own_ai_usage_daily
  ON public.ai_usage_daily FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ai_usage_monthly
DROP POLICY IF EXISTS own_ai_usage_monthly ON public.ai_usage_monthly;
CREATE POLICY own_ai_usage_monthly
  ON public.ai_usage_monthly FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- knowledge_chunks: replace auth.role() call with TO authenticated
DROP POLICY IF EXISTS knowledge_public_read ON public.knowledge_chunks;
CREATE POLICY knowledge_public_read
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (true);

-- user_learning_profile
DROP POLICY IF EXISTS own_learning_profile ON public.user_learning_profile;
CREATE POLICY own_learning_profile
  ON public.user_learning_profile FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- learning_observations
DROP POLICY IF EXISTS own_learning_observations ON public.learning_observations;
CREATE POLICY own_learning_observations
  ON public.learning_observations FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ai_subscriptions
DROP POLICY IF EXISTS own_ai_subscriptions ON public.ai_subscriptions;
CREATE POLICY own_ai_subscriptions
  ON public.ai_subscriptions FOR SELECT
  USING ((select auth.uid()) = user_id);
