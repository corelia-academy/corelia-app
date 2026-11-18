import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findExecutable, runCmd } from "./exec.ts";
import { resolveStepTarget } from "./profile.ts";
import type { AgentProfile, AgentTarget } from "./types.ts";

export interface ExecutionResult {
  provider: string;
  model: string;
  raw_output: string;
  parsed_json: unknown;
  tokens: number | null;
  duration_ms: number;
}

export interface ExecutionError {
  message: string;
  is_rate_limit: boolean;
}

function isRateLimitError(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "rate limit",
    "rate_limit",
    "429",
    "quota exceeded",
    "insufficient_quota",
    "too many requests",
    "overloaded",
    "hết quota",
  ].some((k) => lower.includes(k));
}

/**
 * Extracts a JSON object/array from raw CLI text, fenced code block, or prose with balanced braces.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Model trả về chuỗi rỗng.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // try fenced blocks or balanced extraction
  }

  let searchStart = 0;
  while (searchStart < trimmed.length) {
    const startIdx = trimmed.indexOf("```", searchStart);
    if (startIdx < 0) break;
    const afterStart = trimmed.slice(startIdx + 3);
    const nl = afterStart.indexOf("\n");
    if (nl < 0) break;
    const body = afterStart.slice(nl + 1);
    const endIdx = body.indexOf("```");
    if (endIdx < 0) break;
    const candidate = body.slice(0, endIdx).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      searchStart = startIdx + 3 + nl + 1 + endIdx + 3;
    }
  }

  for (let idx = 0; idx < trimmed.length; idx++) {
    const ch = trimmed[idx];
    if (ch !== "{" && ch !== "[") continue;
    const closeCh = ch === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let escaped = false;

    for (let pos = idx; pos < trimmed.length; pos++) {
      const c = trimmed[pos];
      if (inStr) {
        if (escaped) {
          escaped = false;
        } else if (c === "\\") {
          escaped = true;
        } else if (c === '"') {
          inStr = false;
        }
        continue;
      }
      if (c === '"') {
        inStr = true;
      } else if (c === ch) {
        depth += 1;
      } else if (c === closeCh) {
        depth -= 1;
        if (depth === 0) {
          const slice = trimmed.slice(idx, pos + 1);
          try {
            return JSON.parse(slice);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Không trích xuất được JSON hợp lệ từ output của model.");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * RFC 7396 JSON Merge Patch (`null` deletes a key, objects merge recursively, arrays replace).
 */
export function mergeJsonPatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) {
    return patch;
  }
  const base: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      delete base[k];
    } else {
      base[k] = mergeJsonPatch(base[k], v);
    }
  }
  return base;
}

function runClaude(
  target: AgentTarget,
  cwd: string,
  prompt: string,
  timeoutMs: number,
): ExecutionResult {
  const exe = findExecutable(["claude.exe", "claude.cmd", "claude"]);
  if (!exe) {
    throw { message: "Không tìm thấy `claude` CLI trong PATH.", is_rate_limit: false };
  }
  const args = [
    "-p",
    "--model",
    target.model,
    "--output-format",
    "json",
    "--permission-mode",
    "dontAsk",
    "--disallowedTools",
    "Edit,Write,MultiEdit,NotebookEdit",
  ];
  if (target.effort) {
    args.push("--effort", target.effort);
  }

  const started = Date.now();
  const out = runCmd(exe, args, cwd, prompt, timeoutMs);
  const duration_ms = Date.now() - started;

  if (out.timedOut) {
    throw { message: "`claude` vượt quá timeout.", is_rate_limit: false };
  }
  if (!out.exitOk) {
    const combined = `${out.stderr}\n${out.stdout}`;
    throw {
      message: `claude lỗi (${out.exitCode ?? -1}): ${combined.trim()}`,
      is_rate_limit: isRateLimitError(combined),
    };
  }

  let rawText = out.stdout;
  let tokens: number | null = null;
  try {
    const outer = JSON.parse(out.stdout) as {
      result?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (typeof outer.result === "string") {
      rawText = outer.result;
    } else if (outer.result !== undefined) {
      rawText = JSON.stringify(outer.result);
    }
    if (outer.usage) {
      tokens = (outer.usage.input_tokens ?? 0) + (outer.usage.output_tokens ?? 0);
    }
  } catch {
    // plain text fallback
  }

  let parsed_json: unknown;
  try {
    parsed_json = extractJson(rawText);
  } catch (err) {
    throw {
      message: err instanceof Error ? err.message : String(err),
      is_rate_limit: false,
    };
  }

  return {
    provider: "claude",
    model: target.model,
    raw_output: rawText,
    parsed_json,
    tokens,
    duration_ms,
  };
}

function runCodex(
  target: AgentTarget,
  cwd: string,
  prompt: string,
  timeoutMs: number,
): ExecutionResult {
  const exe = findExecutable(["codex.exe", "codex.cmd", "codex"]);
  if (!exe) {
    throw { message: "Không tìm thấy `codex` CLI trong PATH.", is_rate_limit: false };
  }
  const msgPath = path.join(os.tmpdir(), `cm-codex-${process.pid}-${Date.now()}.txt`);
  const args = [
    "exec",
    "--model",
    target.model,
    "--sandbox",
    "read-only",
    "--output-last-message",
    msgPath,
    "-",
  ];
  if (target.effort) {
    args.push("-c", `model_reasoning_effort="${target.effort}"`);
  }

  const started = Date.now();
  const out = runCmd(exe, args, cwd, prompt, timeoutMs);
  const duration_ms = Date.now() - started;

  let msgText = "";
  try {
    if (fs.existsSync(msgPath)) {
      msgText = fs.readFileSync(msgPath, "utf8");
      fs.unlinkSync(msgPath);
    }
  } catch {
    // ignore cleanup errors
  }

  if (out.timedOut) {
    throw { message: "`codex` vượt quá timeout.", is_rate_limit: false };
  }
  if (!out.exitOk) {
    const combined = `${out.stderr}\n${out.stdout}`;
    throw {
      message: `codex lỗi (${out.exitCode ?? -1}): ${combined.trim()}`,
      is_rate_limit: isRateLimitError(combined),
    };
  }

  const rawText = msgText.trim() ? msgText : out.stdout;
  let parsed_json: unknown;
  try {
    parsed_json = extractJson(rawText);
  } catch (err) {
    throw {
      message: err instanceof Error ? err.message : String(err),
      is_rate_limit: false,
    };
  }

  return {
    provider: "codex",
    model: target.model,
    raw_output: rawText,
    parsed_json,
    tokens: null,
    duration_ms,
  };
}

function runAgy(
  target: AgentTarget,
  cwd: string,
  prompt: string,
  timeoutMs: number,
): ExecutionResult {
  const exe = findExecutable(["agy.exe", "agy.cmd", "agy"]);
  if (!exe) {
    throw { message: "Không tìm thấy `agy` CLI trong PATH.", is_rate_limit: false };
  }
  const args = [
    "-p",
    "--model",
    target.model,
    "--output-format",
    "json",
    "--dangerously-skip-permissions",
  ];
  if (target.effort) {
    args.push("--effort", target.effort);
  }

  const started = Date.now();
  const out = runCmd(exe, args, cwd, prompt, timeoutMs);
  const duration_ms = Date.now() - started;

  if (out.timedOut) {
    throw { message: "`agy` vượt quá timeout.", is_rate_limit: false };
  }
  if (!out.exitOk) {
    const combined = `${out.stderr}\n${out.stdout}`;
    throw {
      message: `agy lỗi (${out.exitCode ?? -1}): ${combined.trim()}`,
      is_rate_limit: isRateLimitError(combined),
    };
  }

  let rawText = out.stdout;
  let tokens: number | null = null;
  try {
    const outer = JSON.parse(out.stdout) as {
      result?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (typeof outer.result === "string") rawText = outer.result;
    if (outer.usage) {
      tokens = (outer.usage.input_tokens ?? 0) + (outer.usage.output_tokens ?? 0);
    }
  } catch {
    // ignore wrapper parse error
  }

  let parsed_json: unknown;
  try {
    parsed_json = extractJson(rawText);
  } catch (err) {
    throw {
      message: err instanceof Error ? err.message : String(err),
      is_rate_limit: false,
    };
  }

  return {
    provider: "agy",
    model: target.model,
    raw_output: rawText,
    parsed_json,
    tokens,
    duration_ms,
  };
}

async function runLiteLlm(
  litellmUrl: string,
  target: AgentTarget,
  prompt: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  const url = `${litellmUrl.replace(/\/+$/, "")}/v1/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.LITELLM_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const started = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw {
      message: `Không gọi được LiteLLM: ${err instanceof Error ? err.message : String(err)}`,
      is_rate_limit: false,
    };
  }

  const duration_ms = Date.now() - started;
  const text = await resp.text();
  if (!resp.ok) {
    throw {
      message: `LiteLLM HTTP ${resp.status}: ${text}`,
      is_rate_limit: resp.status === 429 || isRateLimitError(text),
    };
  }

  const body = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content ?? "";
  let parsed_json: unknown;
  try {
    parsed_json = extractJson(content);
  } catch (err) {
    throw {
      message: err instanceof Error ? err.message : String(err),
      is_rate_limit: false,
    };
  }

  return {
    provider: "litellm",
    model: target.model,
    raw_output: content,
    parsed_json,
    tokens: body.usage?.total_tokens ?? null,
    duration_ms,
  };
}

async function executeTarget(
  profile: AgentProfile,
  target: AgentTarget,
  cwd: string,
  prompt: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  switch (target.provider) {
    case "claude":
      return runClaude(target, cwd, prompt, timeoutMs);
    case "codex":
      return runCodex(target, cwd, prompt, timeoutMs);
    case "agy":
      return runAgy(target, cwd, prompt, timeoutMs);
    case "litellm":
      return runLiteLlm(profile.litellm_url, target, prompt, timeoutMs);
    default:
      throw {
        message: `Provider '${target.provider}' chưa được hỗ trợ trực tiếp.`,
        is_rate_limit: false,
      };
  }
}

export async function executeWithProfile(
  profile: AgentProfile,
  stepKey: string,
  cwd: string,
  prompt: string,
  timeoutMs: number,
): Promise<ExecutionResult> {
  const primary = resolveStepTarget(profile, stepKey);
  try {
    return await executeTarget(profile, primary, cwd, prompt, timeoutMs);
  } catch (err) {
    const execErr = err as ExecutionError;
    const fb = profile.fallback;
    if (fb && fb.enabled && (!fb.on_rate_limit || execErr.is_rate_limit)) {
      const fbTarget: AgentTarget = {
        provider: fb.provider,
        model: fb.model,
        effort: fb.effort,
      };
      return executeTarget(profile, fbTarget, cwd, prompt, timeoutMs);
    }
    throw execErr;
  }
}

export function appendRunLog(
  courseDir: string,
  step: number,
  lessonId: string | null,
  role: string,
  model: string,
  event: "start" | "end",
  result?: string,
  tokens?: number | null,
  durationMs?: number | null,
): void {
  fs.mkdirSync(courseDir, { recursive: true });
  const logPath = path.join(courseDir, "run-log.jsonl");
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    step,
    lesson_id: lessonId ?? "-",
    role,
    model,
    event,
    action: event,
  };
  if (result !== undefined) entry.result = result;
  if (tokens !== undefined && tokens !== null) entry.tokens = tokens;
  if (durationMs !== undefined && durationMs !== null) entry.duration_ms = durationMs;
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}
