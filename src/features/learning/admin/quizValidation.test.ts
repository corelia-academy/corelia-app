import { expect, it } from "vitest";
import { validateQuizQuestions } from "./quizValidation";
import type { SectionQuestion } from "@/types/questions";

const question: SectionQuestion = { id: "q", course_id: "course", section_id: "section", order: 0, type: "mcq", question: "Which keyword?", correct_index: 0, options: [{ id: "a", text: "mut" }, { id: "b", text: "pub" }] };
it("points empty quizzes to the question builder", () => {
  expect(validateQuizQuestions("lesson", [])).toEqual([{ lessonId: "lesson", field: "questions", code: "questions_required" }]);
});
it("points missing copy at the exact question or option control", () => {
  expect(validateQuizQuestions("lesson", [{ ...question, question: " ", options: [{ id: "a", text: "" }, { id: "b", text: "pub" }] }]))
    .toEqual([{ lessonId: "lesson", field: "question-q", code: "question_required" }, { lessonId: "lesson", field: "option-q-a", code: "option_required" }]);
});
it.each([-1, 2, 0.5])("rejects an invalid correct option index %s", correct_index => {
  expect(validateQuizQuestions("lesson", [{ ...question, correct_index }])[0].code).toBe("invalid_options");
});
it("accepts valid questions and scoring", () => {
  expect(validateQuizQuestions("lesson", [question])).toEqual([]);
});
