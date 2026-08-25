import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parsePostMigrationLedger,
  parsePostMigrationInspection,
  validatePostMigrationState,
  EXPECTED_POST_MIGRATION_LATEST,
} from "../verify-production-post-migration.mjs";

const canonicalSemanticDefinitions = {
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
  "trigger.trg_guard_ai_chat_session_message_count": {
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
    normalized_definition: "create trigger trg_guard_ai_chat_session_message_count before update of message_count on public.ai_chat_sessions for each row execute function public.guard_ai_chat_session_message_count()",
  },
  "function.guard_ai_chat_session_message_count": {
    function_schema: "public",
    function_name: "guard_ai_chat_session_message_count",
    function_identity_arguments: "",
    result_type: "trigger",
    language: "plpgsql",
    security_definer: false,
    configuration: [],
    normalized_body: "begin\n-- legacy callers may submit a stale aggregate\n-- canonical conversation rows remain authoritative\nif pg_trigger_depth() = 1 and new.message_count is distinct from old.message_count then new.message_count := ( select count(*)::int from public.ai_conversations c where c.session_id = new.id and c.status = 'completed' ); end if; return new; end;",
  },
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
};

const zeroInvariantMetrics = [
  "invariant.conversation_orphans",
  "invariant.conversation_owner_mismatches",
  "invariant.session_count_mismatches",
  "invariant.orphan_ai_vouchers",
  "invariant.orphan_ai_voucher_redemptions",
  "invariant.duplicate_project_provenance_groups",
  "invariant.paid_course_purchase_missing_access",
  "invariant.paid_course_purchase_missing_enrollment",
  "invariant.refund_ledger_exceeds_payment",
  "invariant.financial_rpc_client_execute_grants",
];

function validVersions() {
  const versions = Array.from({ length: 153 }, (_, index) => String(20260000000000 + index));
  versions[152] = EXPECTED_POST_MIGRATION_LATEST;
  return versions;
}

function validInspectionRows() {
  return [
    ...zeroInvariantMetrics.map((metric) => ({ metric, value: "0" })),
    ...Object.entries(canonicalSemanticDefinitions).map(([metric, value]) => ({
      metric,
      value: JSON.stringify(value),
    })),
  ];
}

function verify(inspectionRows = validInspectionRows()) {
  const versions = validVersions();
  return validatePostMigrationState({
    localVersions: [...versions],
    remoteVersions: [...versions],
    inspectionRows,
  });
}

function mutateMetric(metric, mutate) {
  return validInspectionRows().map((row) => {
    if (row.metric !== metric) return row;
    const value = JSON.parse(row.value);
    mutate(value);
    return { ...row, value: JSON.stringify(value) };
  });
}

test("parsePostMigrationLedger parses valid rows and rejects empty output", () => {
  const parsed = parsePostMigrationLedger(`
    Local          | Remote         | Time (UTC)
    20260101000000 | 20260101000000 | 2026-01-01 00:00:00
    20260823140000 | 20260823140000 | 2026-08-23 14:00:00
  `);
  assert.deepEqual(parsed.localVersions, ["20260101000000", "20260823140000"]);
  assert.deepEqual(parsed.remoteVersions, ["20260101000000", "20260823140000"]);
  assert.throws(() => parsePostMigrationLedger("not a ledger"), /Could not parse/);
});

test("parsePostMigrationInspection parses strict JSON and CLI table output", () => {
  const rows = validInspectionRows();
  assert.deepEqual(parsePostMigrationInspection(JSON.stringify(rows)), rows);
  assert.deepEqual(parsePostMigrationInspection(JSON.stringify({ rows })), rows);

  const table = `metric | value\n-------|------\n${rows[0].metric} | ${rows[0].value}`;
  assert.deepEqual(parsePostMigrationInspection(table), [rows[0]]);
});

test("parsePostMigrationInspection fails closed on malformed or incomplete envelopes", () => {
  assert.throws(() => parsePostMigrationInspection(""), /empty or malformed/);
  assert.throws(() => parsePostMigrationInspection("{}"), /contains no rows/);
  assert.throws(() => parsePostMigrationInspection('[{"metric":"x"}]'), /no string value/);
  assert.throws(() => parsePostMigrationInspection("warning without rows"), /Malformed inspection table output/);
  assert.throws(
    () => parsePostMigrationInspection(`malformed prefix\n${validInspectionRows()[0].metric} | 0`),
    /Malformed inspection table output/,
  );
});

test("exact correct semantic fixture passes", () => {
  assert.deepEqual(verify(), { ok: true, errors: [] });
});

test("live inspection SQL emits guard object and function semantics while preserving data invariant", () => {
  const sql = readFileSync(new URL("../production-post-migration-inspect.sql", import.meta.url), "utf8");
  assert.match(sql, /'invariant\.session_count_mismatches'/);
  assert.match(sql, /'trigger\.trg_guard_ai_chat_session_message_count'/);
  assert.match(sql, /'function\.guard_ai_chat_session_message_count'/);
  assert.match(sql, /pg_get_triggerdef\(t\.oid, false\)/);
  assert.match(sql, /t\.tgattr::smallint\[\]/);
  assert.match(sql, /lower\(btrim\(p\.prosrc\)\) AS normalized_body/);
  assert.doesNotMatch(sql, /regexp_replace\(lower\(btrim\(p\.prosrc\)\)/);
});

test("same FK name with wrong local columns fails", () => {
  const result = verify(mutateMetric("constraint.ai_conversations_session_user_fkey", (value) => {
    value.local_columns = ["session_id"];
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Semantic definition mismatch/);
});

test("same FK name with wrong referenced table fails", () => {
  const result = verify(mutateMetric("constraint.ai_conversations_session_user_fkey", (value) => {
    value.referenced_table = "profiles";
  }));
  assert.equal(result.ok, false);
});

test("same policy name with wrong WITH CHECK fails", () => {
  const result = verify(mutateMetric("policy.own_conversations", (value) => {
    value.with_check_expression = "(auth.uid() = user_id)";
  }));
  assert.equal(result.ok, false);
});

test("policy with wrong mode, command, role, or USING expression fails", () => {
  for (const mutate of [
    (value) => { value.permissive = false; },
    (value) => { value.command = "SELECT"; },
    (value) => { value.roles = ["public"]; },
    (value) => { value.using_expression = "true"; },
  ]) {
    assert.equal(verify(mutateMetric("policy.own_conversations", mutate)).ok, false);
  }
});

test("policy attached to the wrong table fails", () => {
  const result = verify(mutateMetric("policy.own_conversations", (value) => {
    value.table_name = "ai_chat_sessions";
  }));
  assert.equal(result.ok, false);
});

test("trigger with the same name but disabled fails", () => {
  const result = verify(mutateMetric("trigger.trg_sync_ai_chat_session_message_count", (value) => {
    value.enabled = "DISABLED";
  }));
  assert.equal(result.ok, false);
});

test("trigger pointing to the wrong function fails", () => {
  const result = verify(mutateMetric("trigger.trg_sync_ai_chat_session_message_count", (value) => {
    value.function_name = "unrelated_trigger_function";
  }));
  assert.equal(result.ok, false);
});

test("trigger on the wrong relation or with wrong events fails", () => {
  for (const mutate of [
    (value) => { value.table_name = "ai_chat_sessions"; },
    (value) => { value.events = ["INSERT", "UPDATE"]; },
    (value) => { value.timing = "BEFORE"; },
  ]) {
    assert.equal(verify(mutateMetric("trigger.trg_sync_ai_chat_session_message_count", mutate)).ok, false);
  }
});

test("guard trigger is required and missing guard output fails closed", () => {
  const rows = validInspectionRows().filter(
    (row) => row.metric !== "trigger.trg_guard_ai_chat_session_message_count",
  );
  const result = verify(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing semantic inspection result.*trg_guard/);
});

test("guard trigger disabled state fails closed", () => {
  const result = verify(mutateMetric("trigger.trg_guard_ai_chat_session_message_count", (value) => {
    value.enabled = "DISABLED";
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\.enabled/);
});

function assertGuardTriggerMutationFails(mutate) {
  const result = verify(mutateMetric("trigger.trg_guard_ai_chat_session_message_count", mutate));
  assert.equal(result.ok, false);
}

test("guard trigger attached to wrong table fails closed", () => {
  assertGuardTriggerMutationFails((value) => { value.table_name = "ai_conversations"; });
});

test("guard trigger pointing to wrong function fails closed", () => {
  assertGuardTriggerMutationFails((value) => { value.function_name = "sync_ai_chat_session_message_count"; });
});

test("guard trigger with wrong timing fails closed", () => {
  assertGuardTriggerMutationFails((value) => { value.timing = "AFTER"; });
});

test("guard trigger with wrong event fails closed", () => {
  assertGuardTriggerMutationFails((value) => { value.events = ["INSERT"]; });
});

test("guard trigger targeting wrong UPDATE column fails closed", () => {
  assertGuardTriggerMutationFails((value) => { value.update_columns = ["updated_at"]; });
});

test("guard trigger normalized definition must preserve meaningful semantics", () => {
  const whitespaceVariant = mutateMetric("trigger.trg_guard_ai_chat_session_message_count", (value) => {
    value.normalized_definition = "CREATE   TRIGGER trg_guard_ai_chat_session_message_count BEFORE\nUPDATE OF message_count ON public.ai_chat_sessions FOR EACH ROW EXECUTE FUNCTION guard_ai_chat_session_message_count ( )";
  });
  assert.equal(verify(whitespaceVariant).ok, true);

  const wrongDefinition = mutateMetric("trigger.trg_guard_ai_chat_session_message_count", (value) => {
    value.normalized_definition = "create trigger trg_guard_ai_chat_session_message_count before update on public.ai_chat_sessions for each row execute function public.guard_ai_chat_session_message_count()";
  });
  assert.equal(verify(wrongDefinition).ok, false);
});

test("guard function metadata and normalized body contract fail closed", () => {
  for (const mutate of [
    (value) => { value.security_definer = true; },
    (value) => { value.language = "sql"; },
    (value) => { value.result_type = "void"; },
    (value) => { value.normalized_body = value.normalized_body.replace("pg_trigger_depth() = 1", "pg_trigger_depth() = 2"); },
    (value) => { value.normalized_body = value.normalized_body.replace("new.message_count is distinct from old.message_count", "true"); },
    (value) => { value.normalized_body = value.normalized_body.replace("c.status = 'completed'", "c.status = 'pending'"); },
    (value) => { value.normalized_body = value.normalized_body.replace("return new;", "return old;"); },
    (value) => { value.normalized_body += " new.message_count := 999;"; },
    (value) => { value.normalized_body += " update public.ai_chat_sessions set message_count = 999;"; },
  ]) {
    const result = verify(mutateMetric("function.guard_ai_chat_session_message_count", mutate));
    assert.equal(result.ok, false);
  }
});

test("guard function contract present only in line or block comments fails closed", () => {
  const commentOnlyBodies = [
    "begin -- if pg_trigger_depth() = 1 and new.message_count is distinct from old.message_count then new.message_count := (select count(*)::int from public.ai_conversations c where c.session_id = new.id and c.status = 'completed'); end if;\n return new; end;",
    "begin /* if pg_trigger_depth() = 1 and new.message_count is distinct from old.message_count then new.message_count := (select count(*)::int from public.ai_conversations c where c.session_id = new.id and c.status = 'completed'); end if; */ return new; end;",
  ];
  for (const normalizedBody of commentOnlyBodies) {
    const result = verify(mutateMetric("function.guard_ai_chat_session_message_count", (value) => {
      value.normalized_body = normalizedBody;
    }));
    assert.equal(result.ok, false);
  }
});

test("guard function AND weakened to OR fails closed", () => {
  const result = verify(mutateMetric("function.guard_ai_chat_session_message_count", (value) => {
    value.normalized_body = value.normalized_body.replace(
      "pg_trigger_depth() = 1 and new.message_count is distinct from old.message_count",
      "pg_trigger_depth() = 1 or new.message_count is distinct from old.message_count",
    );
  }));
  assert.equal(result.ok, false);
});

test("guard function early return or RAISE fails closed", () => {
  for (const injectedStatement of ["return new;", "raise exception 'stop';"]) {
    const result = verify(mutateMetric("function.guard_ai_chat_session_message_count", (value) => {
      value.normalized_body = value.normalized_body.replace("begin", `begin ${injectedStatement}`);
    }));
    assert.equal(result.ok, false);
  }
});

test("guard function extra DML or NEW-row mutation fails closed", () => {
  for (const injectedStatement of [
    "update public.ai_chat_sessions set updated_at = now() where id = new.id;",
    "new.updated_at := now();",
    "select now() into new.updated_at;",
  ]) {
    const result = verify(mutateMetric("function.guard_ai_chat_session_message_count", (value) => {
      value.normalized_body = value.normalized_body.replace("return new;", `${injectedStatement} return new;`);
    }));
    assert.equal(result.ok, false);
  }
});

test("guard semantic output malformed JSON fails closed", () => {
  const rows = validInspectionRows().map((row) =>
    row.metric === "function.guard_ai_chat_session_message_count"
      ? { ...row, value: "{malformed" }
      : row
  );
  const result = verify(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /malformed JSON/);
});

test("RPC with the same name but wrong signature fails", () => {
  const result = verify(mutateMetric("function.record_ai_successful_usage", (value) => {
    value.argument_types = ["uuid", "text"];
  }));
  assert.equal(result.ok, false);
});

test("RPC with wrong SECURITY DEFINER state fails", () => {
  const result = verify(mutateMetric("function.patch_hackathon_metrics_snapshot", (value) => {
    value.security_definer = false;
  }));
  assert.equal(result.ok, false);
});

test("RPC with wrong search_path fails", () => {
  const result = verify(mutateMetric("function.patch_hackathon_metrics_snapshot", (value) => {
    value.configuration = ["search_path=public"];
  }));
  assert.equal(result.ok, false);
});

test("RPC with wrong EXECUTE privilege fails", () => {
  const result = verify(mutateMetric("function.record_ai_successful_usage", (value) => {
    value.explicit_execute_roles = ["anon", "service_role"];
  }));
  assert.equal(result.ok, false);
});

test("retained AI table with RLS disabled fails closed", () => {
  const result = verify(mutateMetric("table.ai_usage_log.rls", (value) => {
    value.rls_enabled = false;
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Semantic definition mismatch/);
});

test("archived_at without archived_by fails", () => {
  const rows = validInspectionRows().filter((row) => row.metric !== "column.ai_voucher_batches.archived_by");
  const result = verify(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing semantic inspection result.*archived_by/);
});

test("voucher archive field with wrong type or nullability fails", () => {
  const wrongType = mutateMetric("column.ai_voucher_batches.archived_at", (value) => {
    value.data_type = "timestamp without time zone";
  });
  assert.equal(verify(wrongType).ok, false);

  const wrongNullability = mutateMetric("column.ai_voucher_batches.archived_by", (value) => {
    value.not_null = true;
  });
  assert.equal(verify(wrongNullability).ok, false);
});

test("voucher FK with wrong delete action fails", () => {
  const result = verify(mutateMetric("constraint.ai_vouchers_batch_id_fkey", (value) => {
    value.on_delete = "CASCADE";
  }));
  assert.equal(result.ok, false);
});

test("nonzero integrity count fails", () => {
  const rows = validInspectionRows().map((row) =>
    row.metric === "invariant.conversation_owner_mismatches" ? { ...row, value: "2" } : row
  );
  const result = verify(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Data integrity violation/);
});

test("malformed, missing, duplicate, and unexpected semantic rows fail closed", () => {
  const malformed = validInspectionRows();
  malformed[0] = { ...malformed[0], value: "not-json-or-count" };
  assert.equal(verify(malformed).ok, false);
  assert.equal(verify(validInspectionRows().slice(1)).ok, false);

  const duplicated = validInspectionRows();
  duplicated.push({ ...duplicated[0] });
  assert.equal(verify(duplicated).ok, false);

  const unexpected = validInspectionRows();
  unexpected.push({ metric: "constraint.unapproved_object", value: "{}" });
  assert.equal(verify(unexpected).ok, false);
});

test("migration ledger fails on count, latest, pending, remote-only, or duplicate versions", () => {
  const versions = validVersions();
  assert.equal(validatePostMigrationState({
    localVersions: versions,
    remoteVersions: versions.slice(0, -1),
    inspectionRows: validInspectionRows(),
  }).ok, false);

  const wrongLatest = [...versions];
  wrongLatest[wrongLatest.length - 1] = "20260825139999";
  assert.equal(validatePostMigrationState({
    localVersions: wrongLatest,
    remoteVersions: wrongLatest,
    inspectionRows: validInspectionRows(),
  }).ok, false);

  const remoteOnly = [...versions];
  const localWithoutOne = remoteOnly.slice(1);
  assert.equal(validatePostMigrationState({
    localVersions: localWithoutOne,
    remoteVersions: remoteOnly,
    inspectionRows: validInspectionRows(),
  }).ok, false);

  const duplicated = [...versions];
  duplicated[10] = duplicated[9];
  assert.equal(validatePostMigrationState({
    localVersions: duplicated,
    remoteVersions: duplicated,
    inspectionRows: validInspectionRows(),
  }).ok, false);

  const reordered = [...versions];
  [reordered[10], reordered[11]] = [reordered[11], reordered[10]];
  assert.equal(validatePostMigrationState({
    localVersions: versions,
    remoteVersions: reordered,
    inspectionRows: validInspectionRows(),
  }).ok, false);
});
