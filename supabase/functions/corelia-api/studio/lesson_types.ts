// What a lesson generation produces, shaped like the app's records so publish only has to write
// them. Field names and types follow src/types/courses.ts (CourseLesson, LessonResource),
// src/features/learning/types.ts (QuizConfig, PracticeConfig), src/types/questions.ts
// (SectionQuestionData) and src/features/code-exercise/types.ts.

import type { CodeExerciseConfig } from "./lesson_ports.ts";
import type { Diagram } from "./diagram.ts";

export type LessonFormat = "video" | "article" | "quiz" | "practice" | "code_exercise";

export const MIN_QUIZ_QUESTIONS = 5;

/**
 * Module steps 1 (warm_up) and 3 (quick_check) are short quizzes; every other quiz needs MIN_QUIZ_QUESTIONS.
 * The minimum follows the lesson purpose, not the format.
 */
const SHORT_QUIZ_MIN_QUESTIONS: Record<string, number> = { warm_up: 1, quick_check: 2 };

export function minQuizQuestions(purpose: string | undefined): number {
  return (purpose && SHORT_QUIZ_MIN_QUESTIONS[purpose]) || MIN_QUIZ_QUESTIONS;
}

export interface LessonResource {
  title: string;
  url: string;
}

export interface QuizConfig {
  passing_ratio: number;
  allow_retry: boolean;
}

/** Only the practice modes a course without submissions can use. */
export interface PracticeConfig {
  mode: "instruction" | "checklist";
  checklist_items?: { id: string; label: string }[];
  requires_review?: boolean;
}

export interface CodeExercisePartLocale {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>;
  test_copy?: Record<string, { description?: string; failure_message?: string; hint?: string }>;
}

export interface CodeExerciseLocaleContent {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>;
  test_copy?: Record<string, { description?: string; failure_message?: string; hint?: string }>;
  parts?: [CodeExercisePartLocale, CodeExercisePartLocale];
}

export interface CourseLesson {
  id: string;
  section_id: string;
  title: string;
  short_description?: string;
  description_markdown?: string;
  resources?: LessonResource[];
  lesson_format?: LessonFormat;
  youtube_url?: string;
  youtube_start_seconds?: number;
  youtube_end_seconds?: number | null;
  duration_seconds: number;
  order: number;
  quiz_config?: QuizConfig;
  practice_config?: PracticeConfig;
  code_exercise_config?: CodeExerciseConfig;
  code_exercise_locale?: CodeExerciseLocaleContent;
}

/** SectionQuestionData: stored in course_section_questions.data, with lesson_id set to the quiz lesson. */
export interface QuestionData {
  type: "mcq";
  question: string;
  options: { id: string; text: string }[];
  correct_index: number;
  explanation?: string;
  locale?: string;
}

export interface LessonDiagram extends Diagram {
  /** Referenced from description_markdown as ![alt](diagram:id). */
  id: string;
  alt: string;
}

export interface LessonDraft {
  /**
   * section_id is the curriculum module id and order the position inside that module; both are
   * placeholders until publish creates the course sections and assigns real values.
   */
  lesson: CourseLesson;
  /** Quiz lessons only; one row each in course_section_questions at publish. */
  questions: QuestionData[];
  /** Article lessons only; rendered to PNG later, only the spec is kept now. */
  diagrams: LessonDiagram[];
  source_ids: string[];
  summary: string;
}
