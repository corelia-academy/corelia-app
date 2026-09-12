import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateLearningQuestions } from "./questionCache";

it("invalidates both editors, readiness and quiz consumers without writing into another course cache", async () => {
  const client = new QueryClient();
  const affected = [["courses", "learning-readiness", "a"], ["courses", "instructor-editor", "questions", "a"], ["learning-editor-questions", "a", "lesson", "user"], ["learning-quiz", "a", "lesson", "learner", "user", "en"], ["lesson-quiz", "user", "a", "lesson"]];
  const other = ["learning-editor-questions", "b", "lesson", "user"];
  for (const key of [...affected, other]) client.setQueryData(key, { original: key });
  await invalidateLearningQuestions(client, "a");
  for (const key of affected) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  expect(client.getQueryData(other)).toEqual({ original: other });
  client.clear();
});
