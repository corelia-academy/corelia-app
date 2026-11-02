import { MAX_SOURCE_BYTES, sourceBytes } from "./evaluate";
import type { CodeExerciseDraft } from "./types";
export const codeDraftKey = (user: string, course: string, lesson: string, revision: number) => `corelia:code-exercise:${user}:${course}:${lesson}:${revision}`;
function normalizeDraft(value: unknown): CodeExerciseDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  if (typeof d.updated_at !== "string") return null;
  if (d.mode === "edit" && typeof d.source === "string" && sourceBytes(d.source) <= MAX_SOURCE_BYTES) {
    return { mode: "edit", source: d.source, updated_at: d.updated_at };
  }
  if (d.mode === "fill" && d.answers && typeof d.answers === "object" && !Array.isArray(d.answers)
    && Object.values(d.answers).every(v => typeof v === "string" && !/[\r\n]/.test(v))
    && sourceBytes(JSON.stringify(d.answers)) <= MAX_SOURCE_BYTES) {
    return { mode: "fill", answers: { ...d.answers } as Record<string, string>, updated_at: d.updated_at };
  }
  if (d.mode === "two_stage") {
    const stage1_answers = (d.stage1_answers && typeof d.stage1_answers === "object" && !Array.isArray(d.stage1_answers)
      && Object.values(d.stage1_answers).every(v => typeof v === "string" && !/[\r\n]/.test(v)))
      ? { ...d.stage1_answers } as Record<string, string>
      : {};
    const stage2_source = typeof d.stage2_source === "string" ? d.stage2_source : "";
    if (sourceBytes(JSON.stringify(stage1_answers)) > MAX_SOURCE_BYTES || sourceBytes(stage2_source) > MAX_SOURCE_BYTES) return null;
    const active_stage: 1 | 2 = d.active_stage === 2 ? 2 : 1;
    const stage1_passed = typeof d.stage1_passed === "boolean" ? d.stage1_passed : undefined;
    return {
      mode: "two_stage",
      stage1_answers,
      stage2_source,
      active_stage,
      stage1_passed,
      updated_at: d.updated_at,
    };
  }
  return null;
}
export function readCodeDraft(key: string): CodeExerciseDraft | null {
  try {
    const raw = localStorage.getItem(key);
    // A source byte can occupy six bytes as a JSON escape (e.g. \u0000).
    // Enforce the source limit after parsing, without rejecting valid escaped drafts.
    if (!raw || sourceBytes(raw) > MAX_SOURCE_BYTES * 6 + 1024) return null;
    return normalizeDraft(JSON.parse(raw));
  } catch { /* Corrupt/blocked local storage must not block practice. */ }
  return null;
}
export function saveCodeDraft(key: string, draft: CodeExerciseDraft): boolean {
  try {
    const normalized = normalizeDraft(draft);
    if (!normalized) return false;
    localStorage.setItem(key, JSON.stringify(normalized));
    return true;
  } catch { return false; }
}
