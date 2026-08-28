export const PRODUCTION_BASELINE_COUNT = 139;
export const PRODUCTION_BASELINE_LATEST = "20260818120000";

export const APPROVED_PENDING_MIGRATION_PATHS = Object.freeze([
  "supabase/migrations/20260823120000_seed_projects_without_overwrite.sql",
  "supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql",
  "supabase/migrations/20260823122000_hackathon_canonical_project_compatibility.sql",
  "supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql",
  "supabase/migrations/20260823140000_g2_r1_remediation.sql",
  "supabase/migrations/20260825100000_payment_refund_and_access_provenance_schema.sql",
  "supabase/migrations/20260825110000_atomic_payment_settlement_and_enrollment_rpcs.sql",
  "supabase/migrations/20260825120000_master_schema_classification_lifecycle_and_index_optimization.sql",
  "supabase/migrations/20260825130000_harden_enrollment_provenance_and_security_guards.sql",
  "supabase/migrations/20260825140000_harden_enrollment_payment_purpose_and_timestamp.sql",
  "supabase/migrations/20260825150000_r4_atomic_payment_refund_and_ai_retirement.sql",
  "supabase/migrations/20260825151000_r4_staging_catalog_reconciliation.sql",
  "supabase/migrations/20260825152000_r4_function_definition_reconciliation.sql",
  "supabase/migrations/20260825153000_r4_enable_ai_legacy_rls.sql",
  "supabase/migrations/20260826100000_r5_retired_ai_entitlement_write_guards.sql",
  "supabase/migrations/20260826110000_r5_canonicalize_rls_auto_enable.sql",
  "supabase/migrations/20260826120000_issue_329_payment_retirement_safety.sql",
  "supabase/migrations/20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql",
  "supabase/migrations/20260827130000_remove_daily_streak_feature.sql",
  "supabase/migrations/20260828060630_harden_security_definer_rpc_boundaries.sql",
]);

export const APPROVED_PENDING_VERSIONS = Object.freeze(
  APPROVED_PENDING_MIGRATION_PATHS.map((path) => path.match(/\/(\d{14})_/)[1]),
);
export const EXPECTED_POST_MIGRATION_COUNT = PRODUCTION_BASELINE_COUNT + APPROVED_PENDING_VERSIONS.length;
export const EXPECTED_POST_MIGRATION_LATEST = APPROVED_PENDING_VERSIONS.at(-1);
