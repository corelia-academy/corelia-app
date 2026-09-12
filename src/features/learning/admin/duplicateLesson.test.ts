import { expect, it } from "vitest";
import { duplicateLesson, type LessonLocales } from "./duplicateLesson";
import { defaultCodeConfig } from "@/features/code-exercise/config";
import type { CourseLesson } from "@/types/courses";
import type { SectionQuestion } from "@/types/questions";

const lesson: CourseLesson = { id: "original", section_id: "section", title: "Quiz", duration_seconds: 123, order: 2, published: true, archived_at: "2026-09-11", lesson_format: "quiz", quiz_config: { passing_ratio: 0.7, allow_retry: false } };
const title = (value: string) => `${value} (copy)`;

it("copies bilingual quiz with new identities and retains original history references", () => {
  const questions: SectionQuestion[] = [{ id: "question", course_id: "course", section_id: "section", type: "mcq", order: 0, question: "Original?", options: [{ id: "a", text: "Answer" }, { id: "b", text: "Other" }], correct_index: 0, created_at: "old" }];
  const locales: LessonLocales = { en: { title: "English", question_copy: { question: { question: "Translated?", options: { a: "Translation" } }, archivedQuestion: { question: "Removed" } }, updated_at: "old" } };
  const before = structuredClone({ lesson, questions, locales });
  const copy = duplicateLesson(lesson, questions, locales, 12, title);
  expect(copy.lesson).toMatchObject({ published: false, archived_at: null, order: 12, duration_seconds: 123, title: "Quiz (copy)", quiz_config: lesson.quiz_config });
  expect(copy.lesson.id).not.toBe(lesson.id);
  expect(copy.questions[0].id).not.toBe(questions[0].id);
  expect(copy.questions[0].correct_index).toBe(0);
  expect(copy.questions[0].options).toEqual(questions[0].options);
  expect(copy.questions[0].created_at).toBeUndefined();
  expect(copy.locales.en?.question_copy).toEqual({ [copy.questions[0].id]: locales.en!.question_copy!.question });
  expect(copy.locales.en?.updated_at).toBeUndefined();
  copy.questions[0].options[0].text = "Changed copy";
  expect({ lesson, questions, locales }).toEqual(before);
});

it("keeps code marker/test identities and locale copy within a new lesson scope", () => {
  const config = defaultCodeConfig();
  const original = { ...lesson, lesson_format: "code_exercise" as const, code_exercise_config: config };
  const copy = duplicateLesson(original, [], { en: { code_exercise_locale: { hints: ["Use mut"] } } }, 9, title);
  expect(copy.lesson.code_exercise_config).toEqual(config);
  expect(copy.locales.en?.code_exercise_locale?.hints).toEqual(["Use mut"]);
  copy.lesson.code_exercise_config!.file.starter_source = "new source";
  expect(original.code_exercise_config.file.starter_source).toBe(config.file.starter_source);
  expect(config.file.starter_source).not.toBe("new source");
});
