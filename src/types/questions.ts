export interface QuestionOption {
  id: string;
  text: string;
}

export type QuestionType = "mcq";

export interface SectionQuestion {
  id: string;
  course_id: string;
  section_id: string;
  order: number;
  type: QuestionType;
  question: string;
  options: QuestionOption[];
  correct_index: number;
  explanation?: string;
  locale?: string;
  created_at?: string;
  updated_at?: string;
}

export type SectionQuestionData = Pick<
  SectionQuestion,
  "type" | "question" | "options" | "correct_index" | "explanation" | "locale"
>;

export interface SectionQuestionAttempt {
  id: string;
  user_id: string;
  course_id: string;
  section_id: string;
  question_id: string;
  selected_index: number;
  is_correct: boolean;
  attempted_at: string;
}

export interface SectionQuizResult {
  section_id: string;
  total: number;
  correct: number;
  completed: boolean;
  attempts: SectionQuestionAttempt[];
}
