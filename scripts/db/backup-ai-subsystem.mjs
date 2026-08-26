#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const LINKED_ENVIRONMENTS = new Set(["staging", "production"]);
const SUPABASE_PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

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

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readRequiredOption(argv, option) {
  const index = argv.indexOf(option);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function requireCanonicalProjectRef(value, label = "project ref") {
  if (typeof value !== "string" || !SUPABASE_PROJECT_REF_PATTERN.test(value)) {
    throw new Error(`${label} must be exactly 20 lowercase alphanumeric characters.`);
  }
  return value;
}

export function parseAiBackupCliArgs(argv) {
  const useLinkedSupabase = argv.includes("--linked") || argv.includes("--production");
  const rawEnvironment = readRequiredOption(argv, "--environment");
  const explicitEnvironment = rawEnvironment?.trim().toLowerCase() || null;
  const expectedProjectRef = readRequiredOption(argv, "--expected-project-ref");

  if (useLinkedSupabase) {
    const environment = argv.includes("--production") ? "production" : explicitEnvironment;
    if (!environment || !LINKED_ENVIRONMENTS.has(environment)) {
      throw new Error("Linked backup requires --environment staging|production.");
    }
    if (argv.includes("--production") && explicitEnvironment && explicitEnvironment !== "production") {
      throw new Error("--production cannot be combined with a non-production --environment.");
    }
    if (!expectedProjectRef) {
      throw new Error("Linked backup requires --expected-project-ref <exact-project-ref>.");
    }
    return {
      environment,
      expectedProjectRef: requireCanonicalProjectRef(expectedProjectRef, "--expected-project-ref"),
      useLinkedSupabase: true,
    };
  }

  const environment = (explicitEnvironment || process.env.NODE_ENV || "local").trim().toLowerCase();
  if (LINKED_ENVIRONMENTS.has(environment)) {
    throw new Error(`${environment} backup requires --linked and an exact expected project ref.`);
  }
  return {
    environment,
    expectedProjectRef: null,
    useLinkedSupabase: false,
  };
}

export function getCurrentGitHead(commandRunner = execSync) {
  try {
    const sha = String(commandRunner("git rev-parse HEAD", {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    })).trim();
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new Error("git rev-parse returned an invalid SHA.");
    }
    return sha.toLowerCase();
  } catch {
    throw new Error("Could not resolve the current Git HEAD SHA for backup provenance.");
  }
}

export function assertCleanGitWorktree(commandRunner = execSync, cwd = process.cwd()) {
  try {
    const status = String(commandRunner("git status --porcelain --untracked-files=all", {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    })).trim();
    if (status !== "") {
      throw new Error("dirty");
    }
  } catch {
    throw new Error("Linked staging/production backup requires a clean Git worktree.");
  }
}

function resolveGitHeadSha(gitHeadSha) {
  const sha = gitHeadSha || getCurrentGitHead();
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Backup provenance requires a valid 40-character Git HEAD SHA.");
  }
  return sha.toLowerCase();
}

export function computeSourceFingerprint(provenance) {
  const {
    source_fingerprint_sha256: _ignored,
    ...sourceIdentity
  } = provenance;
  return sha256(canonicalJson(sourceIdentity));
}

export function readLinkedProjectState({
  workspaceRoot = process.cwd(),
} = {}) {
  const metadataPath = resolve(workspaceRoot, "supabase", ".temp", "linked-project.json");
  const projectRefPath = resolve(workspaceRoot, "supabase", ".temp", "project-ref");
  if (!existsSync(projectRefPath)) {
    throw new Error("Canonical Supabase CLI project-ref is missing.");
  }

  const projectRef = requireCanonicalProjectRef(
    readFileSync(projectRefPath, "utf8").trim(),
    "Supabase CLI project-ref",
  );
  let metadata = null;
  if (existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    } catch {
      throw new Error("Optional linked project metadata is malformed JSON.");
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("Optional linked project metadata must be a JSON object.");
    }
    if (metadata.ref !== undefined) {
      const metadataRef = requireCanonicalProjectRef(metadata.ref, "Linked project metadata ref");
      if (metadataRef !== projectRef) {
        throw new Error(
          "Linked project identity does not match the exact expected project ref; optional metadata diverges from canonical project-ref.",
        );
      }
    }
  }
  return { metadata, projectRef };
}

export function assertLinkedProjectState({ workspaceRoot, expectedProjectRef }) {
  const canonicalExpectedRef = requireCanonicalProjectRef(expectedProjectRef, "Expected project ref");
  const { metadata, projectRef } = readLinkedProjectState({ workspaceRoot });
  if (projectRef !== canonicalExpectedRef) {
    throw new Error("Linked project identity does not match the exact expected project ref.");
  }
  return { metadata, projectRef };
}

export function resolveLinkedProjectProvenance({
  environment,
  expectedProjectRef,
  workspaceRoot = process.cwd(),
  gitHeadSha,
} = {}) {
  if (!LINKED_ENVIRONMENTS.has(environment)) {
    throw new Error("Linked backup environment must be exactly staging or production.");
  }
  const canonicalExpectedRef = requireCanonicalProjectRef(expectedProjectRef, "Expected project ref");
  const { metadata, projectRef } = assertLinkedProjectState({
    workspaceRoot,
    expectedProjectRef: canonicalExpectedRef,
  });

  const sourceIdentity = {
    source_mode: "linked",
    environment,
    project_ref: projectRef,
    project_name: typeof metadata?.name === "string" ? metadata.name : null,
    organization_id: typeof metadata?.organization_id === "string" ? metadata.organization_id : null,
    git_head_sha: resolveGitHeadSha(gitHeadSha),
  };

  return {
    ...sourceIdentity,
    source_fingerprint_sha256: computeSourceFingerprint(sourceIdentity),
  };
}

function resolveBackupProvenance({
  environment,
  useLinkedSupabase,
  expectedProjectRef,
  workspaceRoot,
  gitHeadSha,
  tableDataFetcher,
  useLivePostgres,
}) {
  if (useLinkedSupabase) {
    return resolveLinkedProjectProvenance({
      environment,
      expectedProjectRef,
      workspaceRoot,
      gitHeadSha,
    });
  }

  if (LINKED_ENVIRONMENTS.has(environment)) {
    throw new Error(`${environment} backup requires linked project provenance.`);
  }

  const sourceIdentity = {
    source_mode: typeof tableDataFetcher === "function"
      ? "custom_fetcher"
      : useLivePostgres
        ? "local_postgres"
        : "empty_fixture",
    environment,
    project_ref: null,
    project_name: null,
    organization_id: null,
    git_head_sha: resolveGitHeadSha(gitHeadSha),
  };
  return {
    ...sourceIdentity,
    source_fingerprint_sha256: computeSourceFingerprint(sourceIdentity),
  };
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
export function fetchTableDataFromLocalPostgres(tableName, commandRunner = execSync) {
  try {
    const query = `SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT * FROM public.${tableName}) t;`;
    const output = commandRunner(
      `docker exec -i supabase_db_corelia-app psql -U postgres -d postgres -t -A -c "${query}"`,
      { encoding: "utf8", windowsHide: true, timeout: 120_000 },
    ).trim();

    if (!output) {
      throw new Error("empty output");
    }
    const rows = JSON.parse(output);
    if (!Array.isArray(rows)) {
      throw new Error("non-array output");
    }
    return rows;
  } catch {
    throw new Error(`Local PostgreSQL query failed for table ${tableName}.`);
  }
}

/**
 * Fetch all registered tables from one Linked Supabase statement snapshot.
 */
export function fetchAllTableDataFromSupabaseLinked(
  {
    commandRunner = execSync,
    tempDirectory = tmpdir(),
    workspaceRoot = process.cwd(),
    expectedProjectRef,
    linkedProjectMetadata = null,
  } = {},
) {
  const canonicalProjectRef = requireCanonicalProjectRef(expectedProjectRef, "Expected project ref");
  const isolatedWorkdir = mkdtempSync(join(resolve(tempDirectory), "corelia-ai-linked-query-"));
  const isolatedSupabaseTempDir = join(isolatedWorkdir, "supabase", ".temp");
  const queryFile = join(isolatedWorkdir, "query_ai_subsystem.sql");
  try {
    mkdirSync(isolatedSupabaseTempDir, { recursive: true });
    writeFileSync(join(isolatedSupabaseTempDir, "project-ref"), `${canonicalProjectRef}\n`, "utf8");
    if (linkedProjectMetadata) {
      const safeMetadata = {
        ref: canonicalProjectRef,
        name: typeof linkedProjectMetadata.name === "string" ? linkedProjectMetadata.name : null,
        organization_id: typeof linkedProjectMetadata.organization_id === "string"
          ? linkedProjectMetadata.organization_id
          : null,
      };
      writeFileSync(
        join(isolatedSupabaseTempDir, "linked-project.json"),
        JSON.stringify(safeMetadata),
        "utf8",
      );
    }
    const entries = AI_TABLE_REGISTRY.map(({ name }) =>
      `  '${name}', (SELECT COALESCE(json_agg(t), '[]'::json) FROM public.${name} t)`,
    ).join(",\n");
    const query = `SELECT json_build_object(\n${entries}\n) AS data;\n`;
    writeFileSync(queryFile, query, "utf8");

    const supabaseCli = resolve(
      workspaceRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "supabase.cmd" : "supabase",
    );
    const cmd = `"${supabaseCli}" db query --linked --file "${queryFile}"`;
    const output = commandRunner(cmd, {
      cwd: isolatedWorkdir,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });

    if (typeof output !== "string") {
      throw new Error("Linked query returned non-text output.");
    }
    const jsonStart = output.indexOf("{");
    const jsonEnd = output.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd < jsonStart) {
      throw new Error("Linked query returned no JSON result.");
    }

    const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) {
      throw new Error("Linked query JSON does not contain a result row.");
    }
    const data = parsed.rows[0]?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Linked query JSON result does not contain a table-data object.");
    }
    const expectedNames = new Set(AI_TABLE_REGISTRY.map(({ name }) => name));
    const actualNames = Object.keys(data);
    if (actualNames.length !== expectedNames.size || actualNames.some((name) => !expectedNames.has(name))) {
      throw new Error("Linked query result has missing or unexpected table keys.");
    }
    for (const { name } of AI_TABLE_REGISTRY) {
      if (!Array.isArray(data[name])) {
        throw new Error(`Linked query result for ${name} is not an array.`);
      }
    }
    return data;
  } catch {
    throw new Error("Linked Supabase snapshot query failed.");
  } finally {
    rmSync(isolatedWorkdir, { recursive: true, force: true });
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
  expectedProjectRef = null,
  workspaceRoot = process.cwd(),
  gitHeadSha,
  linkedCommandRunner = execSync,
  gitCommandRunner = execSync,
} = {}) {
  if (useLinkedSupabase && typeof tableDataFetcher === "function") {
    throw new Error("Linked backup cannot use a custom tableDataFetcher.");
  }
  const normalizedEnvironment = String(environment).trim().toLowerCase();
  if (LINKED_ENVIRONMENTS.has(normalizedEnvironment) && !useLinkedSupabase) {
    throw new Error(`${normalizedEnvironment} backup requires linked project provenance.`);
  }
  if (useLinkedSupabase) {
    assertCleanGitWorktree(gitCommandRunner, workspaceRoot);
  }
  const provenance = resolveBackupProvenance({
    environment: normalizedEnvironment,
    useLinkedSupabase,
    expectedProjectRef,
    workspaceRoot,
    gitHeadSha,
    tableDataFetcher,
    useLivePostgres,
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(targetDir || join(workspaceRoot, ".backups", "ai-retirement", `${normalizedEnvironment}-${timestamp}`));
  if (existsSync(backupDir)) {
    throw new Error("Refusing to overwrite or reuse an existing backup target.");
  }
  mkdirSync(dirname(backupDir), { recursive: true });
  const partialDir = join(dirname(backupDir), `.${basename(backupDir)}.partial-${process.pid}-${Date.now()}`);
  if (existsSync(partialDir)) rmSync(partialDir, { recursive: true, force: true });

  try {
    let linkedSnapshot = null;
    if (useLinkedSupabase) {
      const linkedState = assertLinkedProjectState({ workspaceRoot, expectedProjectRef });
      linkedSnapshot = fetchAllTableDataFromSupabaseLinked({
        commandRunner: linkedCommandRunner,
        workspaceRoot,
        expectedProjectRef: linkedState.projectRef,
        linkedProjectMetadata: linkedState.metadata,
      });
      assertLinkedProjectState({ workspaceRoot, expectedProjectRef });
    }

    const dataDir = join(partialDir, "data");
    mkdirSync(dataDir, { recursive: true });
    const ddlContent = generateSchemaDdl();
    writeFileSync(join(partialDir, "schema_ai_subsystem.sql"), ddlContent, "utf8");
    const tableManifest = [];

    for (const table of AI_TABLE_REGISTRY) {
      let rows = [];
      if (typeof tableDataFetcher === "function") {
        try {
          rows = tableDataFetcher(table.name);
        } catch {
          throw new Error(`Custom table data fetch failed for ${table.name}.`);
        }
      } else if (useLinkedSupabase) {
        rows = linkedSnapshot[table.name];
      } else if (useLivePostgres) {
        rows = fetchTableDataFromLocalPostgres(table.name);
      }
      if (!Array.isArray(rows)) {
        throw new Error(`Backup data for ${table.name} must be an array.`);
      }

      const jsonContent = JSON.stringify(rows, null, 2);
      const fileName = `${table.name}.json`;
      writeFileSync(join(dataDir, fileName), jsonContent, "utf8");
      tableManifest.push({
        table_name: table.name,
        classification: table.classification,
        primaryKey: table.primaryKey,
        description: table.description,
        file: `data/${fileName}`,
        row_count: rows.length,
        bytes: Buffer.byteLength(jsonContent, "utf8"),
        sha256: sha256(jsonContent),
      });
    }

    const restoreVerifierArgs = provenance.source_mode === "linked"
      ? `<backup_dir> --expected-environment ${normalizedEnvironment} --expected-project-ref ${provenance.project_ref}`
      : `<backup_dir> --expected-environment ${normalizedEnvironment}`;
    const manifestData = {
      schema_version: 2,
      backup_id: `AI-BACKUP-${normalizedEnvironment.toUpperCase()}-${timestamp}`,
      generated_at: new Date().toISOString(),
      environment: normalizedEnvironment,
      provenance,
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
        `   node scripts/db/verify-ai-backup-restore.mjs ${restoreVerifierArgs}`,
      ],
    };

    writeFileSync(join(partialDir, "manifest.json"), JSON.stringify(manifestData, null, 2), "utf8");
    renameSync(partialDir, backupDir);
    return {
      backupDir,
      manifestPath: join(backupDir, "manifest.json"),
      manifest: manifestData,
    };
  } catch (error) {
    rmSync(partialDir, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"))) {
  try {
    const options = parseAiBackupCliArgs(process.argv.slice(2));
    const result = executeAiBackup(options);
    console.log(`[AI_BACKUP_SUCCESS] Created real backup at: ${result.backupDir}`);
    console.log(`Environment: ${result.manifest.environment}`);
    console.log(`Tables: ${result.manifest.tables_count}, Total Rows: ${result.manifest.total_rows}`);
    console.log(`Manifest: ${result.manifestPath}`);
  } catch (err) {
    console.error(`[AI_BACKUP_FAILED] ${err.message}`);
    process.exitCode = 1;
  }
}
