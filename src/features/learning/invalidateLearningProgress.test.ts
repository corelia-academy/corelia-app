import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateLearningProgress } from "./invalidateLearningProgress";

it("invalidates every locale of the learner's dashboard progress without touching other users or public content", async () => {
  const client = new QueryClient();
  const changed = [
    ["courses", "enrollment", "learner", "course"],
    ["courses", "catalog-progress", "learner"],
    ["courses", "spotlight", "learner", "vi"],
    ["courses", "spotlight", "learner", "en"],
    ["career", "progress", "learner", "course"],
    ["achievements", "vault", "learner", "vi", "ocid", "Name"],
  ];
  const unchanged = [
    ["courses", "enrollment", "other", "course"],
    ["courses", "enrollment", "learner", "other-course"],
    ["career", "progress", "other", "course"],
    ["courses", "spotlight", "anonymous", "vi"],
    ["courses", "catalog", "vi"],
    ["courses", "progress", "learner", "course"],
  ];
  try {
    for (const key of [...changed, ...unchanged]) client.setQueryData(key, { loaded: true });
    await invalidateLearningProgress(client, "learner", "course");
    for (const key of changed) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of unchanged) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  } finally { client.clear(); }
});

it("waits for an active dashboard refresh without turning a read failure into a failed completion", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ["career", "progress", "learner", "course"];
  client.setQueryData(key, { completed: false });
  let reject!: (reason: Error) => void;
  const observer = new QueryObserver(client, {
    queryKey: key, staleTime: Infinity,
    queryFn: () => new Promise<{ completed: boolean }>((_resolve, fail) => { reject = fail; }),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    let settled = false;
    const refresh = invalidateLearningProgress(client, "learner", "course").then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    reject(new Error("Dashboard network unavailable"));
    await expect(refresh).resolves.toBeUndefined();
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryData(key)).toEqual({ completed: false });
  } finally { unsubscribe(); observer.destroy(); client.clear(); }
});
