import { expect, it } from "vitest";
import { isQuizQuestionShape, recoverQuizQuestion } from "./quizShape";
import { validateQuizQuestions } from "./admin/quizValidation";
import type { SectionQuestion } from "@/types/questions";
it("recovers malformed values without changing stable valid IDs or original data", () => {
  const question = { id: "q", type: "mcq", question: { bad: "text" }, options: [{ id: "stable", text: "Keep" }, { id: "stable", text: 42 }], correct_index: "bad" } as unknown as SectionQuestion;
  const raw = structuredClone(question);
  expect(isQuizQuestionShape(question)).toBe(false);
  expect(validateQuizQuestions("lesson", [question])).toContainEqual(expect.objectContaining({ code: "invalid_options" }));
  const recovered = recoverQuizQuestion(question);
  expect(recovered).toMatchObject({ id: "q", question: "", options: [{ id: "stable", text: "Keep" }, { id: "stable-copy", text: "" }], correct_index: 0 });
  expect(isQuizQuestionShape(recovered)).toBe(true);
  expect(question).toEqual(raw);
});
it("treats malformed option collections as unavailable rather than crashing", () => {
  const question = { type: "mcq", question: "Q", options: {}, correct_index: 0 } as unknown as SectionQuestion;
  expect(isQuizQuestionShape(question)).toBe(false);
  expect(recoverQuizQuestion(question).options).toEqual([]);
});
