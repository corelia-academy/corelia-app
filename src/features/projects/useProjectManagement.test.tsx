// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { manageProject } from "@/lib/projectSubmission";
import { useProjectManagement } from "./useProjectManagement";

vi.mock("@/lib/projectSubmission", () => ({ manageProject: vi.fn(async () => ({})) }));
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

it("finishes project management before cache refetch completes", async () => {
  const client = new QueryClient();
  vi.spyOn(client, "invalidateQueries").mockImplementation(() => new Promise(() => {}));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); client.clear(); };
  let complete!: () => void;
  const completion = new Promise<void>((resolve) => { complete = resolve; });
  function Probe() {
    const mutation = useProjectManagement("project-1");
    return <button onClick={() => { void mutation.mutateAsync({ action: "public", reason: "reviewed" }).then(complete); }}>
      {mutation.isPending ? "pending" : "ready"}
    </button>;
  }
  await act(async () => { root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>); });

  await act(async () => { container.querySelector("button")!.click(); await completion; });

  expect(manageProject).toHaveBeenCalledWith("project-1", "public", "reviewed");
  expect(client.invalidateQueries).toHaveBeenCalled();
  expect(container.textContent).toBe("ready");
});
