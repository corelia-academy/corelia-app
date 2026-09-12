import type { QueryClient } from "@tanstack/react-query";

/** Both authoring surfaces update questions; invalidate every read model. */
export async function invalidateLearningQuestions(client: QueryClient, courseId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["courses"] }),
    client.invalidateQueries({ queryKey: ["learning-editor-questions", courseId] }),
    client.invalidateQueries({ queryKey: ["learning-quiz", courseId] }),
    client.invalidateQueries({ queryKey: ["lesson-quiz"] }),
  ]);
}
