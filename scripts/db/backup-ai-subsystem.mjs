#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Authoritative Registry of AI Subsystem Tables for Epic #332
 * Total: 18 tables across AI chat, knowledge embeddings, usage telemetry, vouchers, subscriptions, and generated content.
 */
export const AI_TABLE_REGISTRY = [
  {
    name: "ai_chat_sessions",
    classification: "AI_RUNTIME_STATE",
    primaryKey: "id",
    description: "Cora chat session containers with contextual metadata",
  },
  {
    name: "ai_conversations",
    classification: "AI_RUNTIME_STATE",
    primaryKey: "id",
    description: "Individual chat messages, role, attachments, token telemetry",
  },
  {
    name: "ai_subscriptions",
    classification: "FINANCIAL_SERVICE_STATE",
    primaryKey: "id",
    description: "Active/expired Cora AI subscriptions linked to payment_transactions",
  },
  {
    name: "ai_usage_daily",
    classification: "DERIVED_AGGREGATE",
    primaryKey: "id",
    description: "Daily aggregated message count, token count, USD cost rollups",
  },
  {
    name: "ai_usage_monthly",
    classification: "DERIVED_AGGREGATE",
    primaryKey: "id",
    description: "Monthly aggregated message count, token count, USD cost rollups",
  },
  {
    name: "ai_usage_log",
    classification: "AUDIT_LOG",
    primaryKey: "id",
    description: "Per-invocation detailed token and cost telemetry ledger",
  },
  {
    name: "ai_model_pricing",
    classification: "CONFIGURATION",
    primaryKey: "model",
    description: "Token cost pricing matrix per AI model",
  },
  {
    name: "tier_limits",
    classification: "CONFIGURATION",
    primaryKey: "tier",
    description: "Membership tier quotas, rolling soft caps, and pricing",
  },
  {
    name: "knowledge_chunks",
    classification: "DERIVED_PROJECTION",
    primaryKey: "id",
    description: "RAG vector embeddings and text chunk index from course catalog",
  },
  {
    name: "user_learning_profile",
    classification: "DERIVED_AGGREGATE",
    primaryKey: "id",
    description: "Diagnostic learner profile, weak/strong topics, AI summaries",
  },
  {
    name: "learning_observations",
    classification: "EVENT_LOG",
    primaryKey: "id",
    description: "Learner insights and observations captured during AI chat",
  },
  {
    name: "ai_voucher_batches",
    classification: "FINANCIAL_SERVICE_STATE",
    primaryKey: "id",
    description: "Voucher batch campaigns and administrative discount budgets",
  },
  {
    name: "ai_vouchers",
    classification: "FINANCIAL_SERVICE_STATE",
    primaryKey: "id",
    description: "Individual voucher discount codes and reservation limits",
  },
  {
    name: "ai_voucher_redemptions",
    classification: "FINANCIAL_TRANSACTION",
    primaryKey: "id",
    description: "Voucher reservation and payment redemption records",
  },
  {
    name: "lesson_summaries",
    classification: "AI_GENERATED_SNAPSHOT",
    primaryKey: "id",
    description: "AI-generated lesson recap summaries and practical tips",
  },
  {
    name: "flashcard_decks",
    classification: "AI_GENERATED_SNAPSHOT",
    primaryKey: "id",
    description: "AI-generated interactive flashcard sets for lesson review",
  },
  {
    name: "lesson_readiness_checks",
    classification: "AI_GENERATED_SNAPSHOT",
    primaryKey: "id",
    description: "AI-generated pre-lesson diagnostic quiz attempts and scores",
  },
  {
    name: "learning_paths",
    classification: "AI_GENERATED_SNAPSHOT",
    primaryKey: "id",
    description: "AI-generated personalized learning roadmaps and milestones",
  },
];

export function sha256(content) {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return createHash("sha256").update(text).digest("hex");
}

export function generateSchemaDdl() {
  return `-- ==============================================================================
-- CORELIA AI SUBSYSTEM DDL BACKUP SCHEMA (EPIC #332)
-- Standalone schema DDL for safe isolated restoration
-- ==============================================================================

-- Minimal referenced entities if restoring in isolated standalone database
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  role text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id text PRIMARY KEY,
  user_id uuid,
  course_id text,
  purpose text,
  amount_vnd integer,
  provider text,
  status text,
  created_at timestamptz DEFAULT now()
);

-- 1. AI Chat Sessions
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  context_type text NOT NULL,
  title text,
  course_id text,
  lesson_id text,
  message_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id text,
  course_id text,
  session_id uuid REFERENCES public.ai_chat_sessions (id) ON DELETE CASCADE,
  context_type text NOT NULL DEFAULT 'lesson',
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  model_used text,
  complexity text,
  tokens_used int NOT NULL DEFAULT 0,
  cached boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. AI Usage Daily
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  message_count int NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- 4. AI Usage Monthly
CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month text NOT NULL,
  message_count int NOT NULL DEFAULT 0,
  tokens_used int NOT NULL DEFAULT 0,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

-- 5. Tier Limits
CREATE TABLE IF NOT EXISTS public.tier_limits (
  tier text PRIMARY KEY CHECK (tier IN ('free', 'student', 'pro', 'bootcamp')),
  monthly_messages int,
  rolling_3h_soft_cap int,
  haiku_only boolean NOT NULL DEFAULT true,
  price_vnd_monthly int,
  monthly_tokens int,
  rolling_3h_tokens int,
  quota_unit text DEFAULT 'message' CHECK (quota_unit IN ('message', 'token', 'both')),
  label_vi text,
  label_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Knowledge Chunks
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  subtopic text,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'corelia',
  track text,
  content_category text NOT NULL DEFAULT 'lesson',
  source_table text NOT NULL DEFAULT 'legacy',
  source_id text NOT NULL,
  source_updated_at timestamptz NOT NULL DEFAULT now(),
  locale text NOT NULL DEFAULT 'vi',
  title text NOT NULL,
  chunk_kind text NOT NULL DEFAULT 'legacy',
  chunk_index integer NOT NULL DEFAULT 0,
  checksum text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding_model text,
  embedded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. User Learning Profile
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

-- 8. Learning Observations
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

-- 9. AI Subscriptions
CREATE TABLE IF NOT EXISTS public.ai_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('student', 'pro', 'bootcamp')),
  duration_months int NOT NULL CHECK (duration_months IN (1, 6, 12)),
  price_vnd int NOT NULL,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payment_transaction_id text NOT NULL REFERENCES public.payment_transactions (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'superseded', 'refunded')),
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. AI Voucher Batches
CREATE TABLE IF NOT EXISTS public.ai_voucher_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  percent_off int NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  target_tier text,
  target_duration_months int,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. AI Vouchers
CREATE TABLE IF NOT EXISTS public.ai_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.ai_voucher_batches (id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  percent_off int,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int DEFAULT 1,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. AI Voucher Redemptions
CREATE TABLE IF NOT EXISTS public.ai_voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.ai_vouchers (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  payment_transaction_id text REFERENCES public.payment_transactions (id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('reserved', 'paid', 'released')),
  base_amount_vnd int,
  discount_amount_vnd int NOT NULL DEFAULT 0,
  final_amount_vnd int,
  reserved_until timestamptz,
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13. AI Usage Log
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature text NOT NULL,
  conversation_id uuid,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd numeric(10, 6),
  estimated boolean NOT NULL DEFAULT false,
  request_id text,
  usage_kind text NOT NULL DEFAULT 'successful_message',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. AI Model Pricing
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  model text PRIMARY KEY,
  input_per_1m_usd numeric(10, 4) NOT NULL,
  output_per_1m_usd numeric(10, 4) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 15. Lesson Summaries
CREATE TABLE IF NOT EXISTS public.lesson_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi',
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  practical_tips jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_kinds text[] NOT NULL DEFAULT '{}',
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_summaries_user_lesson_uq UNIQUE (user_id, lesson_id)
);

-- 16. Flashcard Decks
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi',
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_kinds text[] NOT NULL DEFAULT '{}',
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_decks_user_lesson_uq UNIQUE (user_id, lesson_id)
);

-- 17. Lesson Readiness Checks
CREATE TABLE IF NOT EXISTS public.lesson_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_lesson_ids text[] NOT NULL DEFAULT '{}',
  user_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score numeric(5, 2),
  passed boolean,
  skipped boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_readiness_checks_user_lesson_uq UNIQUE (user_id, lesson_id)
);

-- 18. Learning Paths
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  goal text NOT NULL,
  user_level text,
  locale text NOT NULL DEFAULT 'vi',
  summary text,
  estimated_weeks integer,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_courses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  weekly_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_paths_user_goal_uq UNIQUE (user_id, goal)
);
`;
}

/**
 * Fetch table rows from local PostgreSQL container
 */
export function fetchTableDataFromLocalPostgres(tableName) {
  try {
    const query = `SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT * FROM public.${tableName}) t;`;
    const output = execSync(
      `docker exec -i supabase_db_corelia-app psql -U postgres -d postgres -t -A -c "${query}"`,
      { encoding: "utf8", windowsHide: true },
    ).trim();

    if (!output) return [];
    return JSON.parse(output);
  } catch (err) {
    console.warn(`[WARN] Could not fetch table ${tableName} from local Postgres: ${err.message}`);
    return [];
  }
}

/**
 * Fetch table rows from Linked Supabase Project (Production/Staging)
 */
export function fetchTableDataFromSupabaseLinked(tableName) {
  const tmpFile = join(tmpdir(), `query_${tableName}_${Date.now()}.sql`);
  try {
    const query = `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (SELECT * FROM public.${tableName}) t;`;
    writeFileSync(tmpFile, query, "utf8");

    const cmd = `pnpm exec supabase db query --linked --file "${tmpFile}"`;
    const output = execSync(cmd, {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });

    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.rows && parsed.rows[0] && Array.isArray(parsed.rows[0].data)) {
      return parsed.rows[0].data;
    }
    return [];
  } catch (err) {
    console.warn(`[WARN] Could not fetch table ${tableName} from linked Supabase: ${err.message}`);
    return [];
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * Execute AI Subsystem Backup
 */
export function executeAiBackup({
  targetDir,
  environment = "local",
  useLinkedSupabase = false,
  useLivePostgres = true,
  tableDataFetcher = null,
} = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(targetDir || join(process.cwd(), ".backups", "ai-retirement", `${environment}-${timestamp}`));
  const dataDir = join(backupDir, "data");

  mkdirSync(dataDir, { recursive: true });

  const ddlContent = generateSchemaDdl();
  const ddlPath = join(backupDir, "schema_ai_subsystem.sql");
  writeFileSync(ddlPath, ddlContent, "utf8");

  const tableManifest = [];

  for (const table of AI_TABLE_REGISTRY) {
    let rows = [];
    if (typeof tableDataFetcher === "function") {
      rows = tableDataFetcher(table.name);
    } else if (useLinkedSupabase) {
      rows = fetchTableDataFromSupabaseLinked(table.name);
    } else if (useLivePostgres) {
      rows = fetchTableDataFromLocalPostgres(table.name);
    }

    const jsonContent = JSON.stringify(rows, null, 2);
    const fileName = `${table.name}.json`;
    const filePath = join(dataDir, fileName);
    writeFileSync(filePath, jsonContent, "utf8");

    const digest = sha256(jsonContent);

    tableManifest.push({
      table_name: table.name,
      classification: table.classification,
      primaryKey: table.primaryKey,
      description: table.description,
      file: `data/${fileName}`,
      row_count: rows.length,
      bytes: Buffer.byteLength(jsonContent, "utf8"),
      sha256: digest,
    });
  }

  const manifestData = {
    schema_version: 1,
    backup_id: `AI-BACKUP-${environment.toUpperCase()}-${timestamp}`,
    generated_at: new Date().toISOString(),
    environment,
    epic: "#332",
    issue: "#325",
    tables_count: AI_TABLE_REGISTRY.length,
    total_rows: tableManifest.reduce((acc, t) => acc + t.row_count, 0),
    schema_ddl: {
      file: "schema_ai_subsystem.sql",
      sha256: sha256(ddlContent),
    },
    tables: tableManifest,
    restore_instructions: [
      "1. To restore into isolated PostgreSQL database:",
      "   psql -f schema_ai_subsystem.sql <database_url>",
      "2. To populate table data from JSON fixtures and verify database runtime:",
      "   node scripts/db/verify-ai-backup-restore.mjs --restore-dir <backup_dir>",
    ],
  };

  const manifestJson = JSON.stringify(manifestData, null, 2);
  const manifestPath = join(backupDir, "manifest.json");
  writeFileSync(manifestPath, manifestJson, "utf8");

  return {
    backupDir,
    manifestPath,
    manifest: manifestData,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"))) {
  const isLinked = process.argv.includes("--linked") || process.argv.includes("--production");
  const env = isLinked ? "production" : (process.env.NODE_ENV || "local");
  const result = executeAiBackup({ environment: env, useLinkedSupabase: isLinked });
  console.log(`[AI_BACKUP_SUCCESS] Created real backup at: ${result.backupDir}`);
  console.log(`Environment: ${result.manifest.environment}`);
  console.log(`Tables: ${result.manifest.tables_count}, Total Rows: ${result.manifest.total_rows}`);
  console.log(`Manifest: ${result.manifestPath}`);
}
