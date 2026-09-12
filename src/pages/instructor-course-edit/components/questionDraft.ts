import type { SectionQuestionData } from "@/types/questions";

export type DraftQuestion = SectionQuestionData & { id: string; _key: string };

export function dataToDraft(question: SectionQuestionData & { id?: string }): DraftQuestion {
  const id = question.id ?? crypto.randomUUID();
  return { ...question, id, _key: id, options: Array.isArray(question.options) ? question.options.map(option => option && typeof option === "object" ? { ...option } : option) : question.options };
}

export function makeBlankQuestion(): DraftQuestion {
  return dataToDraft({
    type: "mcq", question: "", options: ["a", "b", "c", "d"].map(id => ({ id, text: "" })),
    correct_index: 0, explanation: "",
  });
}

export function questionPayload(questions: DraftQuestion[], locale: string): Array<SectionQuestionData & { id: string }> {
  return questions.map(question => ({
    id: question.id, type: question.type, question: question.question.trim(),
    options: question.options.map(option => ({ id: option.id, text: option.text.trim() })),
    correct_index: question.correct_index, explanation: question.explanation?.trim() || undefined, locale,
  }));
}
