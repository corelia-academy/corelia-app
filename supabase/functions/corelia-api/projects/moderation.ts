import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";
import { MODERATION_MODEL, moderateTexts, ProjectAiError } from "./openai.ts";

// Projects leased per worker run; their uncached texts share provider requests.
const WORKER_BATCH = 20;

export type ModerationEntry = { field: string; text: string };

/** Matches private.moderation_text_hash: sha256 hex of the trimmed UTF-8 text. */
export async function moderationTextHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim()));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function recordVerdicts(db: SupabaseClient, rows: Array<{ hash: string; flagged: boolean; categories: string[] }>): Promise<void> {
  if (!rows.length) return;
  const { error } = await db.rpc("record_moderation_results", { p_results: rows, p_model: MODERATION_MODEL });
  if (error) throw new Error(error.message);
}

/**
 * Synchronous moderation for publishing. Cached verdicts (and staff allowlist
 * entries) are reused, so only never-seen text reaches the provider.
 * Throws `moderation_blocked:<field>` for the first flagged field.
 */
export async function moderateProjectTextCached(db: SupabaseClient, projectId: string, entries: ModerationEntry[]): Promise<void> {
  const present = entries.filter((entry) => entry.text.trim());
  if (!present.length) return;
  const hashes = await Promise.all(present.map((entry) => moderationTextHash(entry.text)));
  const { data, error } = await db.rpc("project_moderation_verdicts", { p_project_id: projectId, p_hashes: [...new Set(hashes)] });
  if (error) throw new Error(error.message);
  const cached = new Map(((data ?? []) as Array<{ content_hash: string; flagged: boolean }>).map((row) => [row.content_hash, row.flagged]));

  const blockedIndex = present.findIndex((_, index) => cached.get(hashes[index]!) === true);
  if (blockedIndex >= 0) throw new ProjectAiError(`moderation_blocked:${present[blockedIndex]!.field}`);

  const pending = present.map((entry, index) => ({ entry, hash: hashes[index]! })).filter(({ hash }) => !cached.has(hash));
  const unique = [...new Map(pending.map((item) => [item.hash, item])).values()];
  if (!unique.length) return;
  const verdicts = await moderateTexts(unique.map(({ entry }) => entry.text.trim()));
  await recordVerdicts(db, unique.map(({ hash }, index) => ({ hash, ...verdicts[index]! })));
  const flagged = new Set(unique.filter((_, index) => verdicts[index]!.flagged).map(({ hash }) => hash));
  const first = pending.find(({ hash }) => flagged.has(hash));
  if (first) throw new ProjectAiError(`moderation_blocked:${first.entry.field}`);
}

/** Queue a project for background moderation after a save that skipped it. */
export async function enqueueProjectModeration(db: SupabaseClient, projectId: string, delaySeconds = 60): Promise<void> {
  const { error } = await db.rpc("enqueue_project_moderation", { p_project_id: projectId, p_delay_seconds: delaySeconds });
  if (error) console.warn("[projects.moderation] enqueue failed", projectId, error.message);
}

type ClaimedText = { project_id: string; field: string | null; content_hash: string | null; text_value: string | null; flagged: boolean | null };

/** Cron worker: moderate queued projects in batches and hide published ones that are flagged. */
export async function handleProjectModerationRun(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = Deno.env.get("CORELIA_JOBS_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-jobs-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);

  const { data, error } = await db.rpc("claim_project_moderation", { p_limit: WORKER_BATCH });
  if (error) {
    console.error("[projects.moderation] claim failed", error.message);
    return json({ message: "project_operation_failed" }, 500);
  }
  const rows = (data ?? []) as ClaimedText[];
  const projectIds = [...new Set(rows.map((row) => row.project_id))];
  const uncached = new Map<string, string>();
  for (const row of rows) {
    if (row.content_hash && row.flagged === null && row.text_value) uncached.set(row.content_hash, row.text_value);
  }

  const fresh = new Map<string, boolean>();
  try {
    const hashes = [...uncached.keys()];
    const verdicts = await moderateTexts(hashes.map((hash) => uncached.get(hash)!));
    hashes.forEach((hash, index) => fresh.set(hash, verdicts[index]!.flagged));
    await recordVerdicts(db, hashes.map((hash, index) => ({ hash, ...verdicts[index]! })));
  } catch (error) {
    const message = error instanceof ProjectAiError ? error.code : error instanceof Error ? error.message : "unknown";
    await Promise.all(projectIds.map((projectId) => db.rpc("fail_project_moderation", { p_project_id: projectId, p_error: message })));
    console.error("[projects.moderation] provider failed", message);
    return json({ message: "ai_unavailable" }, 503);
  }

  let blocked = 0;
  for (const projectId of projectIds) {
    const flaggedFields = rows
      .filter((row) => row.project_id === projectId && row.field && row.content_hash &&
        (row.flagged === true || (row.flagged === null && fresh.get(row.content_hash) === true)))
      .map((row) => row.field!);
    const { data: hidden, error: finishError } = await db.rpc("finish_project_moderation", {
      p_project_id: projectId,
      p_flagged_fields: [...new Set(flaggedFields)],
    });
    if (finishError) console.warn("[projects.moderation] finish failed", projectId, finishError.message);
    if (hidden === true) blocked += 1;
  }
  console.info("[projects.moderation] run", { projects: projectIds.length, checked: uncached.size, blocked });
  return json({ ok: true, projects: projectIds.length, checked: uncached.size, blocked });
}
