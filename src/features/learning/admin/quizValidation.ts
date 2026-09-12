import { isQuizQuestionShape } from "../quizShape";
import type { SectionQuestion } from "@/types/questions";
import type { PublishValidationIssue } from "../types";

export function validateQuizQuestions(lessonId: string, questions: SectionQuestion[]): PublishValidationIssue[] {
  if (!questions.length) return [{ lessonId, field: "questions", code: "questions_required" }];
  const issues: PublishValidationIssue[] = [];
  for (const question of questions) {
    const field = `question-${question.id}`;
    if (!isQuizQuestionShape(question)) { issues.push({ lessonId, field: "questions", code: "invalid_options" }); continue; }
    if (!question.question.trim()) issues.push({ lessonId, field, code: "question_required" });
    if (question.options.length < 2 || !Number.isInteger(question.correct_index) || question.correct_index < 0 || question.correct_index >= question.options.length) {
      issues.push({ lessonId, field, code: "invalid_options" });
    }
    for (const option of question.options) {
      if (!option.text.trim()) issues.push({ lessonId, field: `option-${question.id}-${option.id}`, code: "option_required" });
    }
  }
  return issues;
}
