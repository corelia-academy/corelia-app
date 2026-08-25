import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_POST_MIGRATION_COUNT = 153;
export const EXPECTED_POST_MIGRATION_LATEST = "20260825153000";

const zeroInvariant = Object.freeze({ kind: "zero" });
const guardTriggerSemantic = Object.freeze({ kind: "guard-trigger" });
const guardFunctionSemantic = Object.freeze({ kind: "guard-function" });

export const EXPECTED_POST_MIGRATION_INSPECTION = Object.freeze({
  "invariant.conversation_orphans": zeroInvariant,
  "invariant.conversation_owner_mismatches": zeroInvariant,
  "invariant.session_count_mismatches": zeroInvariant,
  "invariant.orphan_ai_vouchers": zeroInvariant,
  "invariant.orphan_ai_voucher_redemptions": zeroInvariant,
  "invariant.duplicate_project_provenance_groups": zeroInvariant,
  "invariant.paid_course_purchase_missing_access": zeroInvariant,
  "invariant.paid_course_purchase_missing_enrollment": zeroInvariant,
  "invariant.refund_ledger_exceeds_payment": zeroInvariant,
  "invariant.financial_rpc_client_execute_grants": zeroInvariant,
  "constraint.ai_chat_sessions_id_user_id_unique": {
    table_schema: "public",
    table_name: "ai_chat_sessions",
    constraint_type: "u",
    local_columns: ["id", "user_id"],
    deferrable: false,
    initially_deferred: false,
    validated: true,
  },
  "constraint.ai_conversations_session_user_fkey": {
    table_schema: "public",
    table_name: "ai_conversations",
    constraint_type: "f",
    local_columns: ["session_id", "user_id"],
    referenced_schema: "public",
    referenced_table: "ai_chat_sessions",
    referenced_columns: ["id", "user_id"],
    on_update: "NO ACTION",
    on_delete: "CASCADE",
    deferrable: false,
    initially_deferred: false,
    validated: true,
  },
  "policy.own_conversations": {
    table_schema: "public",
    table_name: "ai_conversations",
    policy_name: "own_conversations",
    permissive: true,
    command: "ALL",
    roles: ["authenticated"],
    using_expression: "(auth.uid() = user_id)",
    with_check_expression: "((auth.uid() = user_id) AND ((session_id IS NULL) OR (EXISTS ( SELECT 1 FROM ai_chat_sessions s WHERE ((s.id = ai_conversations.session_id) AND (s.user_id = auth.uid()))))))",
  },
  "trigger.trg_sync_ai_chat_session_message_count": {
    table_schema: "public",
    table_name: "ai_conversations",
    trigger_name: "trg_sync_ai_chat_session_message_count",
    enabled: "ORIGIN",
    timing: "AFTER",
    level: "ROW",
    events: ["INSERT", "UPDATE", "DELETE"],
    function_schema: "public",
    function_name: "sync_ai_chat_session_message_count",
    function_identity_arguments: "",
  },
  "trigger.trg_guard_ai_chat_session_message_count": guardTriggerSemantic,
  "function.guard_ai_chat_session_message_count": guardFunctionSemantic,
  "function.record_ai_successful_usage": {
    function_schema: "public",
    function_name: "record_ai_successful_usage",
    argument_types: ["uuid", "text", "uuid", "text", "integer", "integer", "numeric", "boolean"],
    result_type: "boolean",
    security_definer: true,
    configuration: ["search_path=public"],
    explicit_execute_roles: ["service_role"],
  },
  "function.patch_hackathon_metrics_snapshot": {
    function_schema: "public",
    function_name: "patch_hackathon_metrics_snapshot",
    argument_types: ["text", "jsonb"],
    result_type: "jsonb",
    security_definer: true,
    configuration: ["search_path=public, pg_temp"],
    explicit_execute_roles: ["authenticated", "service_role"],
  },
  "function.process_successful_payment": {
    function_schema: "public",
    function_name: "process_successful_payment",
    argument_types: ["text", "jsonb", "timestamp with time zone"],
    result_type: "jsonb",
    security_definer: true,
    configuration: ["search_path=public, pg_temp"],
    explicit_execute_roles: ["service_role"],
  },
  "function.process_payment_refund": {
    function_schema: "public",
    function_name: "process_payment_refund",
    argument_types: ["text", "integer", "text", "uuid", "jsonb"],
    result_type: "jsonb",
    security_definer: true,
    configuration: ["search_path=public, pg_temp"],
    explicit_execute_roles: ["service_role"],
  },
  "table.ai_model_pricing.rls": {
    table_schema: "public",
    table_name: "ai_model_pricing",
    rls_enabled: true,
    rls_forced: false,
  },
  "table.ai_usage_log.rls": {
    table_schema: "public",
    table_name: "ai_usage_log",
    rls_enabled: true,
    rls_forced: false,
  },
  "table.tier_limits.rls": {
    table_schema: "public",
    table_name: "tier_limits",
    rls_enabled: true,
    rls_forced: false,
  },
  "column.payment_transactions.settled_at": {
    table_schema: "public",
    table_name: "payment_transactions",
    column_name: "settled_at",
    data_type: "timestamp with time zone",
    not_null: false,
    default_expression: null,
  },
  "column.course_payment_access.full_access_transaction_id": {
    table_schema: "public",
    table_name: "course_payment_access",
    column_name: "full_access_transaction_id",
    data_type: "text",
    not_null: false,
    default_expression: null,
  },
  "column.course_payment_access.certificate_fee_transaction_id": {
    table_schema: "public",
    table_name: "course_payment_access",
    column_name: "certificate_fee_transaction_id",
    data_type: "text",
    not_null: false,
    default_expression: null,
  },
  "column.ai_voucher_batches.archived_at": {
    table_schema: "public",
    table_name: "ai_voucher_batches",
    column_name: "archived_at",
    data_type: "timestamp with time zone",
    not_null: false,
    default_expression: null,
  },
  "column.ai_voucher_batches.archived_by": {
    table_schema: "public",
    table_name: "ai_voucher_batches",
    column_name: "archived_by",
    data_type: "uuid",
    not_null: false,
    default_expression: null,
  },
  "constraint.ai_voucher_batches_archived_by_fkey": {
    table_schema: "public",
    table_name: "ai_voucher_batches",
    constraint_type: "f",
    local_columns: ["archived_by"],
    referenced_schema: "auth",
    referenced_table: "users",
    referenced_columns: ["id"],
    on_update: "NO ACTION",
    on_delete: "SET NULL",
    deferrable: false,
    initially_deferred: false,
    validated: true,
  },
  "constraint.ai_vouchers_batch_id_fkey": {
    table_schema: "public",
    table_name: "ai_vouchers",
    constraint_type: "f",
    local_columns: ["batch_id"],
    referenced_schema: "public",
    referenced_table: "ai_voucher_batches",
    referenced_columns: ["id"],
    on_update: "NO ACTION",
    on_delete: "RESTRICT",
    deferrable: false,
    initially_deferred: false,
    validated: true,
  },
  "constraint.ai_voucher_redemptions_voucher_id_fkey": {
    table_schema: "public",
    table_name: "ai_voucher_redemptions",
    constraint_type: "f",
    local_columns: ["voucher_id"],
    referenced_schema: "public",
    referenced_table: "ai_vouchers",
    referenced_columns: ["id"],
    on_update: "NO ACTION",
    on_delete: "RESTRICT",
    deferrable: false,
    initially_deferred: false,
    validated: true,
  },
});

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").replace(/^\uFEFF/, "");
}

export function parsePostMigrationLedger(output) {
  if (typeof output !== "string" || output.trim() === "") {
    throw new Error("Post-migration ledger output is empty or malformed.");
  }

  const rows = [];
  const normalized = stripAnsi(output);
  for (const line of normalized.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const localVersion = /^\d{14}$/.test(cells[0]) ? cells[0] : null;
    const remoteVersion = /^\d{14}$/.test(cells[1]) ? cells[1] : null;
    if (localVersion || remoteVersion) rows.push({ localVersion, remoteVersion });
  }

  if (rows.length === 0) {
    throw new Error("Could not parse any migration rows from post-migration ledger output.");
  }

  return {
    localVersions: rows.flatMap((row) => row.localVersion ? [row.localVersion] : []),
    remoteVersions: rows.flatMap((row) => row.remoteVersion ? [row.remoteVersion] : []),
  };
}

function assertInspectionRow(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(`Inspection row ${index} is not an object.`);
  }
  if (typeof row.metric !== "string" || row.metric.trim() === "") {
    throw new Error(`Inspection row ${index} has no valid metric.`);
  }
  if (typeof row.value !== "string") {
    throw new Error(`Inspection row ${index} has no string value.`);
  }
  return { metric: row.metric.trim(), value: row.value.trim() };
}

export function parsePostMigrationInspection(output) {
  if (typeof output !== "string" || output.trim() === "") {
    throw new Error("Post-migration inspection output is empty or malformed.");
  }

  const normalized = stripAnsi(output).trim();
  try {
    const parsed = JSON.parse(normalized);
    const candidateRows = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (!Array.isArray(candidateRows) || candidateRows.length === 0) {
      throw new Error("Inspection JSON contains no rows.");
    }
    return candidateRows.map(assertInspectionRow);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  const rows = [];
  for (const line of normalized.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || /^[+\-\s]+$/.test(trimmed) || /^\(\d+ rows?\)$/.test(trimmed)) continue;
    if (!line.includes("|")) {
      throw new Error(`Malformed inspection table output: ${trimmed}`);
    }
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length !== 2) throw new Error(`Malformed inspection table row: ${trimmed}`);
    if (cells[0].toLowerCase() === "metric" && cells[1].toLowerCase() === "value") continue;
    if (/^-+$/.test(cells[0]) && /^-+$/.test(cells[1])) continue;
    rows.push(assertInspectionRow({ metric: cells[0], value: cells[1] }, rows.length));
  }
  if (rows.length === 0) throw new Error("Could not parse any semantic inspection rows.");
  return rows;
}

function normalizeCatalogString(value) {
  return value.replace(/\s+/g, " ").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return typeof value === "string" ? normalizeCatalogString(value) : value;
}

function semanticEqual(actual, expected) {
  return JSON.stringify(canonicalize(actual)) === JSON.stringify(canonicalize(expected));
}

function requireSemanticField(errors, metric, actual, field, expected) {
  if (!semanticEqual(actual[field], expected)) {
    errors.push(
      `Semantic definition mismatch for ${metric}.${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[field])}.`,
    );
  }
}

function requireNormalizedPattern(errors, metric, definition, description, pattern) {
  if (typeof definition !== "string" || !pattern.test(normalizeCatalogString(definition).toLowerCase())) {
    errors.push(`Semantic definition mismatch for ${metric}: missing ${description}.`);
  }
}

function countNormalizedPattern(definition, pattern) {
  if (typeof definition !== "string") return 0;
  return Array.from(normalizeCatalogString(definition).toLowerCase().matchAll(pattern)).length;
}

function stripSqlComments(value) {
  if (typeof value !== "string") return { body: "", malformed: true };

  let body = "";
  let state = "normal";
  let blockDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const next = value[index + 1];

    if (state === "line-comment") {
      if (current === "\n" || current === "\r") {
        state = "normal";
        body += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (current === "/" && next === "*") {
        blockDepth += 1;
        index += 1;
      } else if (current === "*" && next === "/") {
        blockDepth -= 1;
        index += 1;
        if (blockDepth === 0) {
          state = "normal";
          body += " ";
        }
      }
      continue;
    }

    if (state === "single-quote") {
      body += current;
      if (current === "'" && next === "'") {
        body += next;
        index += 1;
      } else if (current === "'") {
        state = "normal";
      }
      continue;
    }

    if (state === "double-quote") {
      body += current;
      if (current === '"' && next === '"') {
        body += next;
        index += 1;
      } else if (current === '"') {
        state = "normal";
      }
      continue;
    }

    if (current === "-" && next === "-") {
      state = "line-comment";
      body += " ";
      index += 1;
    } else if (current === "/" && next === "*") {
      state = "block-comment";
      blockDepth = 1;
      body += " ";
      index += 1;
    } else {
      body += current;
      if (current === "'") state = "single-quote";
      if (current === '"') state = "double-quote";
    }
  }

  return {
    body: normalizeCatalogString(body).toLowerCase(),
    malformed: state === "block-comment" || state === "single-quote" || state === "double-quote",
  };
}

function validateGuardTrigger(metric, actual, errors) {
  const expectedFields = {
    table_schema: "public",
    table_name: "ai_chat_sessions",
    trigger_name: "trg_guard_ai_chat_session_message_count",
    enabled: "ORIGIN",
    timing: "BEFORE",
    level: "ROW",
    events: ["UPDATE"],
    update_columns: ["message_count"],
    function_schema: "public",
    function_name: "guard_ai_chat_session_message_count",
    function_identity_arguments: "",
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    requireSemanticField(errors, metric, actual, field, expected);
  }

  const definition = actual.normalized_definition;
  requireNormalizedPattern(
    errors,
    metric,
    definition,
    "BEFORE UPDATE OF message_count trigger contract",
    /\bbefore\s+update\s+of\s+message_count\s+on\s+public\.ai_chat_sessions\b/,
  );
  requireNormalizedPattern(
    errors,
    metric,
    definition,
    "row-level guard function execution",
    /\bfor\s+each\s+row\s+execute\s+function\s+(?:public\.)?guard_ai_chat_session_message_count\s*\(\s*\)/,
  );
}

function validateGuardFunction(metric, actual, errors) {
  const expectedFields = {
    function_schema: "public",
    function_name: "guard_ai_chat_session_message_count",
    function_identity_arguments: "",
    result_type: "trigger",
    language: "plpgsql",
    security_definer: false,
    configuration: [],
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    requireSemanticField(errors, metric, actual, field, expected);
  }

  const stripped = stripSqlComments(actual.normalized_body);
  const body = stripped.body;
  if (stripped.malformed) {
    errors.push(`Semantic definition mismatch for ${metric}: malformed SQL comments or quoted text.`);
  }
  requireNormalizedPattern(
    errors,
    metric,
    body,
    "combined direct-trigger depth AND message_count change predicate",
    /\bif\s*\(?\s*pg_trigger_depth\s*\(\s*\)\s*=\s*1\s+and\s+new\.message_count\s+is\s+distinct\s+from\s+old\.message_count\s*\)?\s+then\b/,
  );
  requireNormalizedPattern(
    errors,
    metric,
    body,
    "canonical completed-conversation count assignment",
    /\bnew\.message_count\s*:=\s*\(\s*select\s+count\s*\(\s*\*\s*\)\s*::\s*(?:int|integer)\s+from\s+public\.ai_conversations\s+c\s+where\s+c\.session_id\s*=\s*new\.id\s+and\s+c\.status\s*=\s*'completed'\s*\)/,
  );
  requireNormalizedPattern(errors, metric, body, "RETURN NEW behavior", /\breturn\s+new\s*;/);

  // Fail closed on the complete PL/pgSQL contract instead of relying only on
  // a keyword blacklist. This prevents alternative mutation syntax such as
  // SELECT ... INTO NEW.updated_at from being accepted accidentally.
  const exactGuardContract = /^begin\s+if\s*\(?\s*pg_trigger_depth\s*\(\s*\)\s*=\s*1\s+and\s+new\.message_count\s+is\s+distinct\s+from\s+old\.message_count\s*\)?\s+then\s+new\.message_count\s*:=\s*\(\s*select\s+count\s*\(\s*\*\s*\)\s*::\s*(?:int|integer)\s+from\s+public\.ai_conversations\s+c\s+where\s+c\.session_id\s*=\s*new\.id\s+and\s+c\.status\s*=\s*'completed'\s*\)\s*;\s*end\s+if\s*;\s*return\s+new\s*;\s*end\s*;?$/;
  if (!exactGuardContract.test(body)) {
    errors.push(`Semantic definition mismatch for ${metric}: function body contains behavior outside the canonical guard contract.`);
  }

  if (countNormalizedPattern(body, /\bnew\.message_count\s*:=/g) !== 1) {
    errors.push(`Semantic definition mismatch for ${metric}: expected exactly one message_count assignment.`);
  }
  if (countNormalizedPattern(body, /:=/g) !== 1) {
    errors.push(`Semantic definition mismatch for ${metric}: unexpected extra assignment.`);
  }
  if (countNormalizedPattern(body, /\breturn\s+new\s*;/g) !== 1) {
    errors.push(`Semantic definition mismatch for ${metric}: expected exactly one RETURN NEW.`);
  }
  if (!/\bend\s+if\s*;\s*return\s+new\s*;\s*end\s*;?\s*$/.test(body)) {
    errors.push(`Semantic definition mismatch for ${metric}: RETURN NEW is not the sole final return path.`);
  }
  if (/\bor\b|\breturn\s+(?:old|null)\b|\b(?:raise|exit|exception|execute|perform|call|insert|update|delete|merge|truncate|into)\b/i.test(body)) {
    errors.push(`Semantic definition mismatch for ${metric}: contains unexpected mutation or return behavior.`);
  }
}

function parseSemanticValue(metric, value, errors) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push(`Semantic check ${metric} returned a missing or non-object definition.`);
      return null;
    }
    return parsed;
  } catch {
    errors.push(`Semantic check ${metric} returned malformed JSON.`);
    return null;
  }
}

export function validatePostMigrationState({
  localVersions,
  remoteVersions,
  inspectionRows,
  expectedCount = EXPECTED_POST_MIGRATION_COUNT,
  expectedLatest = EXPECTED_POST_MIGRATION_LATEST,
}) {
  const errors = [];
  if (!Array.isArray(localVersions) || !Array.isArray(remoteVersions) || !Array.isArray(inspectionRows)) {
    return { ok: false, errors: ["Post-migration verification input is malformed."] };
  }

  if (remoteVersions.length !== expectedCount) {
    errors.push(`Remote migration count mismatch: expected ${expectedCount}, got ${remoteVersions.length}.`);
  }
  if (remoteVersions.at(-1) !== expectedLatest) {
    errors.push(`Remote latest migration mismatch: expected ${expectedLatest}, got ${remoteVersions.at(-1) ?? "none"}.`);
  }
  if (new Set(remoteVersions).size !== remoteVersions.length) {
    errors.push("Remote migration ledger contains duplicate versions.");
  }
  if (new Set(localVersions).size !== localVersions.length) {
    errors.push("Local migration ledger contains duplicate versions.");
  }
  if (!localVersions.every((version) => /^\d{14}$/.test(version)) || !remoteVersions.every((version) => /^\d{14}$/.test(version))) {
    errors.push("Migration ledger contains a malformed version.");
  }

  const pendingRemote = localVersions.filter((version) => !remoteVersions.includes(version));
  const remoteOnly = remoteVersions.filter((version) => !localVersions.includes(version));
  if (pendingRemote.length > 0) {
    errors.push(`Unapplied migrations remain on remote: ${pendingRemote.join(", ")}.`);
  }
  if (remoteOnly.length > 0) {
    errors.push(`Remote ledger contains migrations absent from the local release chain: ${remoteOnly.join(", ")}.`);
  }
  if (JSON.stringify(localVersions) !== JSON.stringify(remoteVersions)) {
    errors.push("Local and remote migration ledgers are not identical in canonical order.");
  }

  const metricsMap = new Map();
  for (const [index, row] of inspectionRows.entries()) {
    if (!row || typeof row.metric !== "string" || typeof row.value !== "string") {
      errors.push(`Inspection row ${index} is malformed.`);
      continue;
    }
    if (metricsMap.has(row.metric)) {
      errors.push(`Duplicate semantic inspection metric: ${row.metric}.`);
      continue;
    }
    metricsMap.set(row.metric, row.value);
  }

  for (const metric of metricsMap.keys()) {
    if (!(metric in EXPECTED_POST_MIGRATION_INSPECTION)) {
      errors.push(`Unexpected semantic inspection metric: ${metric}.`);
    }
  }

  for (const [metric, expected] of Object.entries(EXPECTED_POST_MIGRATION_INSPECTION)) {
    const value = metricsMap.get(metric);
    if (value === undefined) {
      errors.push(`Missing semantic inspection result for: ${metric}.`);
      continue;
    }
    if (expected.kind === "zero") {
      if (!/^\d+$/.test(value)) {
        errors.push(`Integrity metric ${metric} is malformed: ${value}.`);
      } else if (value !== "0") {
        errors.push(`Data integrity violation on live DB: ${metric} is ${value} (expected 0).`);
      }
      continue;
    }

    const actual = parseSemanticValue(metric, value, errors);
    if (!actual) continue;
    if (expected.kind === "guard-trigger") {
      validateGuardTrigger(metric, actual, errors);
    } else if (expected.kind === "guard-function") {
      validateGuardFunction(metric, actual, errors);
    } else if (!semanticEqual(actual, expected)) {
      errors.push(
        `Semantic definition mismatch for ${metric}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function run() {
  const [migrationListPath, inspectionPath] = process.argv.slice(2);
  if (!migrationListPath || !inspectionPath) {
    console.error("Usage: node scripts/db/verify-production-post-migration.mjs <migration-list-output> <inspection-output>");
    process.exit(1);
  }

  try {
    const migrationOutput = readFileSync(resolve(process.cwd(), migrationListPath), "utf8");
    const inspectionOutput = readFileSync(resolve(process.cwd(), inspectionPath), "utf8");
    const result = validatePostMigrationState({
      ...parsePostMigrationLedger(migrationOutput),
      inspectionRows: parsePostMigrationInspection(inspectionOutput),
    });

    if (!result.ok) {
      console.error("Production post-migration verification failed closed (EDGE DEPLOYMENT BLOCKED):");
      for (const error of result.errors) console.error(`- ${error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Production post-migration verification failed closed (EDGE DEPLOYMENT BLOCKED):");
    console.error(`- ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log(
    `Production post-migration verification passed: ${EXPECTED_POST_MIGRATION_COUNT} migrations applied, exact DB semantics verified, 0 invariant violations.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) run();
