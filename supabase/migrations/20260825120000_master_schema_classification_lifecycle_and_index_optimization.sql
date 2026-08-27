-- Master Wave Migration 3: Schema Classification, Lifecycle Invariants, and Index Optimization
-- Forward-only, data-preserving migration implementing:
-- 1. Table Role & Schema Governance Classification Comments for all active tables
-- 2. Lifecycle & State Machine Constraints on final_assignment_submissions, course_blast_logs, and hackathons
-- 3. Composite Foreign Key on lesson_progress (course_id, lesson_id) -> course_lessons (course_id, id)
-- 4. Index Workload Optimization (Remove duplicate indexes and add missing foreign-key supporting indexes)

BEGIN;

-- ─── 1. Index Workload Optimization ──────────────────────────────────────────

-- Drop redundant duplicate index (lesson_summaries_user_lesson_uq already covers (user_id, lesson_id))
DROP INDEX IF EXISTS public.idx_lesson_summaries_user_lesson;

-- Add missing foreign-key and workload supporting indexes
CREATE INDEX IF NOT EXISTS idx_course_blast_logs_sender_id
  ON public.course_blast_logs (sender_id);

CREATE INDEX IF NOT EXISTS idx_course_blast_logs_target
  ON public.course_blast_logs (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_observations_user_id
  ON public.learning_observations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_observations_session_id
  ON public.learning_observations (session_id);

CREATE INDEX IF NOT EXISTS idx_section_question_attempts_question_id
  ON public.section_question_attempts (question_id);

CREATE INDEX IF NOT EXISTS idx_section_question_attempts_course_lesson
  ON public.section_question_attempts (course_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_project_comments_author_id
  ON public.project_comments (author_id);

CREATE INDEX IF NOT EXISTS idx_project_collab_invites_project_id
  ON public.project_collaboration_invites (project_id);

CREATE INDEX IF NOT EXISTS idx_course_co_instr_invites_invited_by
  ON public.course_co_instructor_invites (invited_by);

CREATE INDEX IF NOT EXISTS idx_course_co_instr_invites_notification_id
  ON public.course_co_instructor_invites (notification_id);

CREATE INDEX IF NOT EXISTS idx_credential_issuances_granted_by
  ON public.credential_issuances (granted_by);

CREATE INDEX IF NOT EXISTS idx_credential_issuances_course_id
  ON public.credential_issuances (course_id)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credential_issuances_hackathon_id
  ON public.credential_issuances (hackathon_id)
  WHERE hackathon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificate_records_revoked_by
  ON public.certificate_records (revoked_by);

CREATE INDEX IF NOT EXISTS idx_ai_voucher_batches_archived_by
  ON public.ai_voucher_batches (archived_by);

CREATE INDEX IF NOT EXISTS idx_pending_credential_issuances_template_id
  ON public.pending_credential_issuances (template_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
  ON public.user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ─── 2. Relational Integrity Tightening ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lesson_progress_course_lesson_fk'
      AND conrelid = 'public.lesson_progress'::regclass
  ) THEN
    ALTER TABLE public.lesson_progress
      ADD CONSTRAINT lesson_progress_course_lesson_fk
      FOREIGN KEY (course_id, lesson_id)
      REFERENCES public.course_lessons (course_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ─── 3. Lifecycle & State Machine Constraints ────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'final_assignment_submissions_status_chk'
      AND conrelid = 'public.final_assignment_submissions'::regclass
  ) THEN
    ALTER TABLE public.final_assignment_submissions
      ADD CONSTRAINT final_assignment_submissions_status_chk
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_blast_logs_status_chk'
      AND conrelid = 'public.course_blast_logs'::regclass
  ) THEN
    ALTER TABLE public.course_blast_logs
      ADD CONSTRAINT course_blast_logs_status_chk
      CHECK (status IN ('completed', 'failed', 'in_progress', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hackathons_status_chk'
      AND conrelid = 'public.hackathons'::regclass
  ) THEN
    ALTER TABLE public.hackathons
      ADD CONSTRAINT hackathons_status_chk
      CHECK (status IN ('draft', 'published', 'running', 'ended', 'archived'));
  END IF;
END $$;

-- ─── 4. Schema Governance Classification Comments ────────────────────────────

COMMENT ON TABLE public.profiles IS 'CANONICAL_ENTITY: Identity and core user profile';
COMMENT ON TABLE public.public_profiles IS 'DERIVED_PROJECTION: Public profile view and follower aggregates (rebuildable)';
COMMENT ON TABLE public.courses IS 'CANONICAL_ENTITY: Course catalog definitions';
COMMENT ON TABLE public.course_sections IS 'CANONICAL_ENTITY: Ordered curriculum sections';
COMMENT ON TABLE public.course_lessons IS 'CANONICAL_ENTITY: Ordered lesson definitions with video/text metadata';
COMMENT ON TABLE public.course_locales IS 'DERIVED_PROJECTION: Localized course text metadata';
COMMENT ON TABLE public.course_section_locales IS 'DERIVED_PROJECTION: Localized section text metadata';
COMMENT ON TABLE public.course_lesson_locales IS 'DERIVED_PROJECTION: Localized lesson text metadata';
COMMENT ON TABLE public.course_discounts IS 'CONFIGURATION: Discount promo codes for courses';
COMMENT ON TABLE public.course_payment_access IS 'SNAPSHOT: Direct payment access entitlement snapshot';
COMMENT ON TABLE public.enrollments IS 'CANONICAL_ENTITY: Course enrollment and learner access lifecycle';
COMMENT ON TABLE public.lesson_progress IS 'CANONICAL_ENTITY: Learner lesson watch time and completion state';
COMMENT ON TABLE public.final_assignment_submissions IS 'CANONICAL_ENTITY: Student capstone deliverable and grading state';
COMMENT ON TABLE public.course_section_questions IS 'CANONICAL_ENTITY: In-course assessment questions per section';
COMMENT ON TABLE public.section_question_attempts IS 'EVENT_LOG: Learner quiz question attempts and scoring evidence';
COMMENT ON TABLE public.course_co_instructor_invites IS 'PENDING_WORKFLOW: Co-instructor collaboration invitation lifecycle';
COMMENT ON TABLE public.course_blast_logs IS 'AUDIT_LOG: Instructor/staff outbound announcement campaigns';
COMMENT ON TABLE public.career_tracks IS 'CANONICAL_ENTITY: Curated career track curriculum definitions';
COMMENT ON TABLE public.career_track_courses IS 'JOIN_RELATION: Ordered course sequences within career tracks';
COMMENT ON TABLE public.career_track_locales IS 'DERIVED_PROJECTION: Localized career track title and descriptions';
COMMENT ON TABLE public.hackathons IS 'CANONICAL_ENTITY: Hackathon definitions, timelines, and metrics snapshot';
COMMENT ON TABLE public.hackathon_locales IS 'DERIVED_PROJECTION: Localized hackathon title and descriptions';
COMMENT ON TABLE public.hackathon_registrations IS 'JOIN_RELATION: Learner hackathon application and approval state';
COMMENT ON TABLE public.hackathon_submissions IS 'CANONICAL_ENTITY: Hackathon project submission deliverable';
COMMENT ON TABLE public.hackathon_scores IS 'TRANSACTION: Judge evaluation scores per criteria';
COMMENT ON TABLE public.hackathon_access_invites IS 'PENDING_WORKFLOW: Hackathon organizer and judge invitation lifecycle';
COMMENT ON TABLE public.projects IS 'CANONICAL_ENTITY: User portfolio project truth';
COMMENT ON TABLE public.project_collaborators IS 'JOIN_RELATION: Project team membership and editing rights';
COMMENT ON TABLE public.project_collaboration_invites IS 'PENDING_WORKFLOW: Project team invitation lifecycle';
COMMENT ON TABLE public.project_hearts IS 'JOIN_RELATION: Social like events (drives projects.like_count)';
COMMENT ON TABLE public.project_comments IS 'CANONICAL_ENTITY: Project social discussions with soft-delete';
COMMENT ON TABLE public.project_locales IS 'DERIVED_PROJECTION: Localized project descriptions';
COMMENT ON TABLE public.user_notifications IS 'EVENT_LOG: In-app notifications inbox state';
COMMENT ON TABLE public.notification_preferences IS 'CONFIGURATION: User email and in-app channel opt-in/opt-out';
COMMENT ON TABLE public.email_delivery_attempts IS 'AUDIT_LOG: Outbound mail provider delivery telemetry';
COMMENT ON TABLE public.learning_reminder_logs IS 'AUDIT_LOG: Cron-scheduled learner reminder execution logs';
COMMENT ON TABLE public.user_daily_streaks IS 'CANONICAL_AGGREGATE: Authoritative user daily streak and timezone';
COMMENT ON TABLE public.user_daily_streak_claims IS 'EVENT_LOG: Daily streak claim evidence';
COMMENT ON TABLE public.user_point_ledger IS 'LEDGER: Append-only gamification point balance history';
COMMENT ON TABLE public.user_streak_milestone_unlocks IS 'JOIN_RELATION: One-time streak milestone achievement records';
COMMENT ON TABLE public.credential_templates IS 'CONFIGURATION: Open Campus credential definition templates';
COMMENT ON TABLE public.credential_issuances IS 'TRANSACTION: Open Campus blockchain credential issuance snapshots';
COMMENT ON TABLE public.certificate_records IS 'SNAPSHOT: Publicly verifiable course certificate snapshot and revocation state';
COMMENT ON TABLE public.pending_credential_issuances IS 'PENDING_WORKFLOW: Pre-registration credential claim queue';
COMMENT ON TABLE public.follows IS 'JOIN_RELATION: Social follow graph (drives follower/following counters)';
COMMENT ON TABLE public.activity_events IS 'EVENT_LOG: Social activity feed stream';
COMMENT ON TABLE public.knowledge_chunks IS 'DERIVED_PROJECTION: RAG vector embeddings from course content';
COMMENT ON TABLE public.user_learning_profile IS 'DERIVED_AGGREGATE: AI learner profile and knowledge diagnosis';
COMMENT ON TABLE public.learning_observations IS 'EVENT_LOG: AI learning observations captured during chat';
COMMENT ON TABLE public.lesson_summaries IS 'SNAPSHOT: AI-generated lesson recap summaries';
COMMENT ON TABLE public.flashcard_decks IS 'SNAPSHOT: AI-generated interactive flashcards';
COMMENT ON TABLE public.lesson_readiness_checks IS 'SNAPSHOT: Pre-lesson diagnostic quiz attempts and scores';
COMMENT ON TABLE public.learning_paths IS 'SNAPSHOT: AI-generated personalized learning roadmaps';
COMMENT ON TABLE public.ai_chat_sessions IS 'CANONICAL_ENTITY: User AI tutor session container';
COMMENT ON TABLE public.ai_conversations IS 'LOG: Chat message conversation history per AI session';
COMMENT ON TABLE public.ai_model_pricing IS 'CONFIGURATION: Token cost and pricing matrix per model';
COMMENT ON TABLE public.ai_subscriptions IS 'CANONICAL_ENTITY: AI membership subscription state and validity';
COMMENT ON TABLE public.ai_usage_daily IS 'DERIVED_AGGREGATE: Daily aggregated AI token usage rollup';
COMMENT ON TABLE public.ai_usage_monthly IS 'DERIVED_AGGREGATE: Monthly aggregated AI token usage rollup';
COMMENT ON TABLE public.ai_usage_log IS 'AUDIT_LOG: Detailed token usage ledger per AI invocation';
COMMENT ON TABLE public.ai_voucher_batches IS 'CANONICAL_ENTITY: AI voucher batch campaigns';
COMMENT ON TABLE public.ai_vouchers IS 'CANONICAL_ENTITY: AI subscription discount voucher codes';
COMMENT ON TABLE public.ai_voucher_redemptions IS 'TRANSACTION: AI voucher reservation and redemption records';
COMMENT ON TABLE public.search_query_events IS 'EVENT_LOG: Search queries for trending suggestions';
COMMENT ON TABLE public.system_settings IS 'CONFIGURATION: System-wide key-value settings and issuer URLs';
COMMENT ON TABLE public.tier_limits IS 'CONFIGURATION: Membership tier quotas and AI token allowances';
COMMENT ON TABLE public.dashboard_configs IS 'CONFIGURATION: Admin dashboard widget layout and configuration';
COMMENT ON TABLE public.payment_transactions IS 'TRANSACTION: Financial payment transaction ledger (Financial Wave)';
COMMENT ON TABLE public.payment_refunds IS 'TRANSACTION: Payment refund audit and status record (Financial Wave)';

COMMIT;
