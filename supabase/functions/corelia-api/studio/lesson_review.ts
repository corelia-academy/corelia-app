// Step `lesson_review` (A6): an independent review of one lesson draft. The reviewer sees the lesson
// as the app will store it (LessonDraft) and points at fields of that record.

import { lessonRefs, toLessonDraft, type LessonOutput } from "./lessons.ts";
import type { Acceptance, RunContext } from "./steps.ts";

const str = { type: "string" };
const strList = { type: "array", items: str };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export const LESSON_REVIEW_SCHEMA = object({
  verdict: { type: "string", enum: ["pass", "needs_fix"] },
  issues: {
    type: "array",
    items: object({
      /** Field path in the LessonDraft, e.g. lesson.description_markdown or questions[2].options[1]. */
      location: str,
      problem: str,
      fix: str,
      severity: { type: "string", enum: ["blocking", "minor"] },
      verified_by: { type: "string", enum: ["tool", "source", "reasoning"] },
    }),
  },
  /** What could not be verified, e.g. course-language code that was not compiled. */
  unverified: strList,
  summary: str,
});

interface LessonReview {
  verdict: string;
  issues: { location: string; problem: string; severity: string }[];
}

/** Value at a path such as questions[2].options[1] or lesson.code_exercise_config.tests[0]; undefined if absent. */
export function resolvePath(root: unknown, path: string): unknown {
  if (!/^[A-Za-z_]\w*(\.[A-Za-z_]\w*|\[\d+\])*$/.test(path)) return undefined;
  const tokens = path.match(/[A-Za-z_]\w*|\[\d+\]/g)!;
  let node: unknown = root;
  for (const token of tokens) {
    if (node === null || typeof node !== "object") return undefined;
    if (token.startsWith("[")) {
      if (!Array.isArray(node)) return undefined;
      node = node[Number(token.slice(1, -1))];
    } else {
      if (Array.isArray(node) || !Object.hasOwn(node, token)) return undefined;
      node = (node as Record<string, unknown>)[token];
    }
    if (node === undefined) return undefined;
  }
  return node;
}

export function acceptLessonReview(output: unknown, ctx: RunContext, lessonId: string): Acceptance {
  const review = output as LessonReview;
  const lc = ctx.lesson;
  if (!lc?.draft) throw new Error(`lesson ${lessonId} chưa có bản nháp để đối chiếu`);
  const ref = lessonRefs(ctx.outputs.curriculum).find((r) => r.lesson.id === lessonId)!;
  const draft = toLessonDraft(
    ref,
    lc.draft as LessonOutput,
    (ctx.outputs.brief as { locale?: string }).locale,
    ctx.outputs.research as Parameters<typeof toLessonDraft>[3],
  );
  const problems: string[] = [];
  for (const i of review.issues) {
    if (resolvePath(draft, i.location) === undefined) problems.push(`vị trí "${i.location}" không phải field của lesson_draft (một đường dẫn tính từ gốc lesson_draft, không có tiền tố "lesson_draft.", mỗi issue một field; field gốc: lesson, questions, diagrams, source_ids, summary)`);
    if (!i.problem.trim()) problems.push(`vấn đề tại ${i.location} để trống`);
  }
  const blocking = review.issues.filter((i) => i.severity === "blocking").length;
  if (review.verdict === "pass" && blocking > 0) problems.push("verdict pass nhưng còn lỗi blocking");
  if (review.verdict === "needs_fix" && blocking === 0) problems.push("verdict needs_fix nhưng không có lỗi blocking");
  if (problems.length > 0) return { ok: false, reason: `Review lesson ${lessonId} chưa hợp lệ: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? ` (+${problems.length - 3})` : ""}` };
  const minor = review.issues.length - blocking;
  return { ok: true, summary: `${review.verdict}, ${blocking} lỗi blocking, ${minor} minor.` };
}
