import type { SectionQuestionData } from "@/types/questions";
import { lessonText } from "./lessonCopy";

export function isQuizQuestionShape(question: SectionQuestionData): boolean {
  return typeof question.question === "string" && question.type === "mcq" &&
    (question.explanation === undefined || typeof question.explanation === "string") &&
    Number.isInteger(question.correct_index) && question.correct_index >= 0 &&
    Array.isArray(question.options) && question.options.every(option => option &&
      typeof option.id === "string" && option.id.length > 0 && typeof option.text === "string") &&
    new Set(question.options.map(option => option.id)).size === question.options.length;
}

/** Explicit recovery projection; do not replace the editor's raw draft until confirmed. */
export function recoverQuizQuestion<T extends SectionQuestionData>(question: T): T {
  const ids = new Set<string>();
  const options = (Array.isArray(question.options) ? question.options : []).map((option, index) => {
    let id = typeof option?.id === "string" && option.id ? option.id : `recovered-${index}`;
    while (ids.has(id)) id += "-copy";
    ids.add(id);
    return { id, text: lessonText(option?.text, lessonText(option)) };
  });
  return { ...question, type: "mcq", question: lessonText(question.question), explanation: lessonText(question.explanation), options,
    correct_index: Number.isInteger(question.correct_index) && question.correct_index >= 0 ? question.correct_index : 0 };
}

export function isQuizConfigShape(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return (config.passing_ratio === undefined || (typeof config.passing_ratio === "number" && Number.isFinite(config.passing_ratio))) &&
    (config.allow_retry === undefined || typeof config.allow_retry === "boolean");
}
