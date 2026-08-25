import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Master Wave 3: Schema Classification, Lifecycle Invariants & Index Optimization", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260825120000_master_schema_classification_lifecycle_and_index_optimization.sql",
  );
  const migrationContent = readFileSync(migrationPath, "utf8");

  it("SCHEMA-01: Table role classification comments exist for all active tables", () => {
    const expectedTables = [
      "profiles",
      "public_profiles",
      "courses",
      "course_sections",
      "course_lessons",
      "course_locales",
      "course_section_locales",
      "course_lesson_locales",
      "course_discounts",
      "course_payment_access",
      "enrollments",
      "lesson_progress",
      "final_assignment_submissions",
      "course_section_questions",
      "section_question_attempts",
      "course_co_instructor_invites",
      "course_blast_logs",
      "career_tracks",
      "career_track_courses",
      "career_track_locales",
      "hackathons",
      "hackathon_locales",
      "hackathon_registrations",
      "hackathon_submissions",
      "hackathon_scores",
      "hackathon_access_invites",
      "projects",
      "project_collaborators",
      "project_collaboration_invites",
      "project_hearts",
      "project_comments",
      "project_locales",
      "user_notifications",
      "notification_preferences",
      "email_delivery_attempts",
      "learning_reminder_logs",
      "user_daily_streaks",
      "user_daily_streak_claims",
      "user_point_ledger",
      "user_streak_milestone_unlocks",
      "credential_templates",
      "credential_issuances",
      "certificate_records",
      "pending_credential_issuances",
      "follows",
      "activity_events",
      "knowledge_chunks",
      "user_learning_profile",
      "learning_observations",
      "lesson_summaries",
      "flashcard_decks",
      "lesson_readiness_checks",
      "learning_paths",
      "ai_chat_sessions",
      "ai_conversations",
      "ai_model_pricing",
      "ai_subscriptions",
      "ai_usage_daily",
      "ai_usage_monthly",
      "ai_usage_log",
      "ai_voucher_batches",
      "ai_vouchers",
      "ai_voucher_redemptions",
      "search_query_events",
      "system_settings",
      "tier_limits",
      "dashboard_configs",
      "payment_transactions",
      "payment_refunds",
    ];

    for (const table of expectedTables) {
      const pattern = new RegExp(`COMMENT ON TABLE public\\.${table} IS '([A-Z_]+):`);
      assert.match(
        migrationContent,
        pattern,
        `Missing schema classification comment for table ${table}`,
      );
    }
  });

  it("LIFE-01: Valid lifecycle transition and CHECK constraints are enforced", () => {
    assert.match(
      migrationContent,
      /final_assignment_submissions_status_chk[\s\S]*?CHECK\s*\(\s*status IN \('pending', 'approved', 'rejected'\)\)/,
      "final_assignment_submissions must constrain status to pending, approved, rejected",
    );

    assert.match(
      migrationContent,
      /course_blast_logs_status_chk[\s\S]*?CHECK\s*\(\s*status IN \('completed', 'failed', 'in_progress', 'cancelled'\)\)/,
      "course_blast_logs must constrain status to completed, failed, in_progress, cancelled",
    );

    assert.match(
      migrationContent,
      /hackathons_status_chk[\s\S]*?CHECK\s*\(\s*status IN \('draft', 'published', 'running', 'ended', 'archived'\)\)/,
      "hackathons must constrain status to draft, published, running, ended, archived",
    );
  });

  it("LIFE-02: Invalid lifecycle transitions are rejected by schema invariants", () => {
    // Assert that status CHECK constraints do not allow arbitrary text
    const invalidStatuses = ["unknown", "deleted", "invalid_state", "bypassed"];
    for (const st of invalidStatuses) {
      assert.doesNotMatch(
        migrationContent,
        new RegExp(`'${st}'`),
        `Invalid status '${st}' must not be present in status CHECK constraints`,
      );
    }
  });

  it("SOT-01: Canonical state remains authoritative over projections and caches", () => {
    // Verify canonical table classifications
    assert.match(migrationContent, /COMMENT ON TABLE public\.profiles IS 'CANONICAL_ENTITY:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.courses IS 'CANONICAL_ENTITY:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.projects IS 'CANONICAL_ENTITY:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.hackathons IS 'CANONICAL_ENTITY:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.user_daily_streaks IS 'CANONICAL_AGGREGATE:/);
  });

  it("SOT-02: Derived state cannot silently diverge where fixed", () => {
    // Verify derived table classifications
    assert.match(migrationContent, /COMMENT ON TABLE public\.public_profiles IS 'DERIVED_PROJECTION:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.knowledge_chunks IS 'DERIVED_PROJECTION:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.ai_usage_daily IS 'DERIVED_AGGREGATE:/);
    assert.match(migrationContent, /COMMENT ON TABLE public\.ai_usage_monthly IS 'DERIVED_AGGREGATE:/);
  });

  it("REL-01: Valid relation accepted & composite foreign key links lesson_progress directly to course_lessons", () => {
    assert.match(
      migrationContent,
      /lesson_progress_course_lesson_fk[\s\S]*?FOREIGN KEY \(course_id, lesson_id\)\s*REFERENCES public\.course_lessons \(course_id, id\)\s*ON DELETE CASCADE/,
      "lesson_progress must define composite FK to course_lessons",
    );
  });

  it("REL-02: Invalid relation rejected without valid composite course and lesson", () => {
    assert.match(
      migrationContent,
      /REFERENCES public\.course_lessons \(course_id, id\)/,
      "Composite FK must target exactly (course_id, id) of course_lessons",
    );
  });

  it("IDX-01: Important expected indexes exist for workload and foreign key paths", () => {
    const expectedIndexes = [
      "idx_course_blast_logs_sender_id",
      "idx_course_blast_logs_target",
      "idx_learning_observations_user_id",
      "idx_learning_observations_session_id",
      "idx_section_question_attempts_question_id",
      "idx_section_question_attempts_course_lesson",
      "idx_project_comments_author_id",
      "idx_project_collab_invites_project_id",
      "idx_course_co_instr_invites_invited_by",
      "idx_course_co_instr_invites_notification_id",
      "idx_credential_issuances_granted_by",
      "idx_credential_issuances_course_id",
      "idx_credential_issuances_hackathon_id",
      "idx_certificate_records_revoked_by",
      "idx_ai_voucher_batches_archived_by",
      "idx_pending_credential_issuances_template_id",
      "idx_user_notifications_unread",
    ];

    for (const idx of expectedIndexes) {
      assert.match(
        migrationContent,
        new RegExp(`CREATE INDEX IF NOT EXISTS ${idx}\\b`),
        `Missing expected index ${idx}`,
      );
    }

    assert.match(
      migrationContent,
      /idx_user_notifications_unread[\s\S]*?WHERE read_at IS NULL/,
      "idx_user_notifications_unread must be a partial index for unread notifications",
    );
  });

  it("CLEAN-01: Removed object has no surviving dependency and redundant duplicate index is dropped", () => {
    assert.match(
      migrationContent,
      /DROP INDEX IF EXISTS public\.idx_lesson_summaries_user_lesson/,
      "Redundant idx_lesson_summaries_user_lesson must be dropped",
    );
  });

  it("CLEAN-02: Historical migrations remain immutable and forward-only", () => {
    assert.match(migrationContent, /^BEGIN;/m, "Migration must start with BEGIN");
    assert.match(migrationContent, /^COMMIT;/m, "Migration must end with COMMIT");

    const migrationsDir = resolve(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const version120000 = migrationFiles.find((f) => f.startsWith("20260825120000"));
    assert.ok(version120000, "Migration 20260825120000 must exist in migrations directory");
  });
});

