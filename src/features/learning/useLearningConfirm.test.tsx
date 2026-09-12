// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useLearningConfirm } from "./useLearningConfirm";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.restoreAllMocks(); });

async function mount() {
  const resolved = vi.fn();
  const native = vi.spyOn(window, "confirm").mockImplementation(() => { throw new Error("Native confirmation must not run"); });
  function Consumer() {
    const { confirm, confirmation } = useLearningConfirm();
    return <>{confirmation}<button onClick={async () => resolved(await confirm("Keep the draft unless confirmed"))}>Reset draft</button></>;
  }
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  await act(async () => root.render(<Consumer />));
  const click = async (label: string) => { await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent === label);
    expect(button).toBeTruthy(); button!.click();
  }); };
  return { resolved, native, click };
}

it.each([false, true])("uses the application dialog and resolves only after the decision: %s", async accepted => {
  const { resolved, native, click } = await mount();
  await click("Reset draft");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Keep the draft unless confirmed");
  expect(resolved).not.toHaveBeenCalled();
  await click(accepted ? "learning.confirmAction" : "learning.cancel");
  expect(resolved).toHaveBeenCalledExactlyOnceWith(accepted);
  expect(native).not.toHaveBeenCalled();
});

it("cancels a pending action on unmount instead of letting it mutate a new context", async () => {
  const { resolved, click } = await mount();
  await click("Reset draft");
  await act(async () => { cleanup?.(); cleanup = undefined; });
  expect(resolved).toHaveBeenCalledExactlyOnceWith(false);
});
