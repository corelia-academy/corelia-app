import fs from "node:fs";
import path from "node:path";
import type { AgentProfile, AgentTarget } from "./types.ts";

export function defaultAgentProfile(): AgentProfile {
  return {
    coordinator: {
      provider: "agy",
      model: "gemini-3.8-flash-medium",
    },
    default_child: {
      provider: "codex",
      model: "gpt-6-luna",
      effort: "xhigh",
    },
    steps: {
      brief: { provider: "claude", model: "sonnet" },
      research: { provider: "claude", model: "sonnet" },
      curriculum: { provider: "claude", model: "opus" },
      "curriculum-review": { provider: "codex", model: "gpt-6.1-terra", effort: "high" },
      lesson: { provider: "codex", model: "gpt-6-luna", effort: "xhigh" },
      "lesson-review": { provider: "claude", model: "sonnet" },
      "course-review": { provider: "claude", model: "sonnet" },
    },
    fallback: {
      enabled: false,
      provider: "litellm",
      model: "claude-sonnet",
      on_rate_limit: true,
    },
    litellm_url: "http://127.0.0.1:4000",
  };
}

export function normalizeStepKey(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  switch (lower) {
    case "1":
    case "brief":
      return "brief";
    case "2":
    case "research":
      return "research";
    case "3":
    case "curriculum":
      return "curriculum";
    case "4":
    case "curriculum-review":
    case "curriculum_review":
      return "curriculum-review";
    case "5":
    case "lesson":
    case "write":
      return "lesson";
    case "6":
    case "lesson-review":
    case "lesson_review":
    case "review":
      return "lesson-review";
    case "7":
    case "course-review":
    case "course_review":
      return "course-review";
    default:
      return null;
  }
}

export function parseAgentTarget(spec: string): AgentTarget {
  const parts = spec.trim().split(":");
  const provider = (parts[0] ?? "").trim();
  const model = (parts[1] ?? "").trim();
  if (!provider || !model) {
    throw new Error(
      `Spec không hợp lệ '${spec}'. Dùng định dạng <provider>:<model>[:<effort>] (vd: codex:gpt-6-luna:xhigh)`,
    );
  }
  const effort = parts[2]?.trim() || undefined;
  return effort ? { provider, model, effort } : { provider, model };
}

export function globalProfilePath(repoRoot: string): string {
  return path.join(repoRoot, ".course-runs", "agent-profile.json");
}

export function courseProfilePath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, ".course-runs", slug, "agent-profile.json");
}

export function loadProfile(
  repoRoot: string,
  slug?: string,
): { path: string; profile: AgentProfile } {
  const base = defaultAgentProfile();
  const gPath = globalProfilePath(repoRoot);
  let activePath = gPath;

  const mergeFromFile = (filePath: string) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AgentProfile>;
    if (parsed.coordinator) base.coordinator = parsed.coordinator;
    if (parsed.default_child) base.default_child = parsed.default_child;
    if (parsed.steps) base.steps = { ...base.steps, ...parsed.steps };
    if (parsed.fallback) base.fallback = parsed.fallback;
    if (parsed.litellm_url) base.litellm_url = parsed.litellm_url;
  };

  if (fs.existsSync(gPath)) {
    mergeFromFile(gPath);
  }

  if (slug) {
    const cPath = courseProfilePath(repoRoot, slug);
    if (fs.existsSync(cPath)) {
      mergeFromFile(cPath);
      activePath = cPath;
    }
  }

  return { path: activePath, profile: base };
}

export function saveProfile(
  repoRoot: string,
  slug: string | undefined,
  profile: AgentProfile,
): string {
  const target = slug ? courseProfilePath(repoRoot, slug) : globalProfilePath(repoRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return target;
}

export function resolveStepTarget(profile: AgentProfile, stepKey: string): AgentTarget {
  return profile.steps[stepKey] ?? profile.default_child;
}
