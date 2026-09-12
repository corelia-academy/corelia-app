import { describe, expect, it } from "vitest";
import { dataToDraft, makeBlankQuestion, questionPayload } from "./questionDraft";

describe("existing quiz editor payload", () => {
  it("preserves stable question and option IDs with nonstandard option counts", () => {
    const existing = { id: "existing-question", type: "mcq" as const, question: "Before", options: [
      { id: "rust", text: "Rust" }, { id: "go", text: "Go" }, { id: "python", text: "Python" },
    ], correct_index: 2 };
    const draft = dataToDraft(existing);
    draft.question = " After ";
    draft.options[1].text = " Go language ";
    expect(questionPayload([draft], "vi")).toEqual([{
      id: "existing-question", type: "mcq", question: "After", options: [
        { id: "rust", text: "Rust" }, { id: "go", text: "Go language" }, { id: "python", text: "Python" },
      ], correct_index: 2, explanation: undefined, locale: "vi",
    }]);
    expect(existing.options[1].text).toBe("Go");
  });
  it("allocates a stable ID for a new question before saving alongside existing questions", () => {
    const added = makeBlankQuestion();
    added.question = "New question";
    expect(added.id).toBeTruthy();
    expect(questionPayload([added], "en")[0].id).toBe(added.id);
    const submittedId = questionPayload([added], "en")[0].id;
    added.explanation = "Changed after a failed save";
    expect(questionPayload([added], "en")[0].id).toBe(submittedId);
    expect(dataToDraft({ type: "mcq", question: "Generated", options: [], correct_index: 0 }).id).not.toBe(added.id);
  });
});
