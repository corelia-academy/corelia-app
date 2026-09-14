// @vitest-environment happy-dom
import { act } from "react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseCompletionCertificatePanel } from "./CourseCompletionCertificatePanel";

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key,
  }),
}));

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    async render() {
      await act(async () => {
        root.render(ui);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("CourseCompletionCertificatePanel", () => {
  it("does not render revert button when onRevert is not provided", async () => {
    const view = render(
      <CourseCompletionCertificatePanel
        hasCertificate={true}
        certificateIssued={true}
        achievementsPath="/achievements"
      />,
    );
    await view.render();

    const buttons = view.container.querySelectorAll("button");
    const revertBtn = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("Hoàn tác hoàn thành"),
    );
    expect(revertBtn).toBeUndefined();

    await view.unmount();
  });

  it("renders revert button and opens dialog on click", async () => {
    const onRevert = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <CourseCompletionCertificatePanel
        hasCertificate={true}
        certificateIssued={true}
        achievementsPath="/achievements"
        onRevert={onRevert}
      />,
    );
    await view.render();

    const buttons = view.container.querySelectorAll("button");
    const revertBtn = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("Hoàn tác hoàn thành"),
    );
    expect(revertBtn).toBeDefined();

    // Click the revert button
    await act(async () => {
      revertBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Dialog should be open and contain the notice when certificateIssued is true
    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Hoàn tác trạng thái hoàn thành khóa học");
    expect(bodyText).toContain("chứng nhận đã cấp sẽ được bảo lưu");

    // Click confirm button
    const confirmBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Xác nhận hoàn tác"),
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRevert).toHaveBeenCalledWith("last_lesson");

    await view.unmount();
  });

  it("does not show certificate preservation notice if certificate is not issued", async () => {
    const onRevert = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <CourseCompletionCertificatePanel
        hasCertificate={false}
        certificateIssued={false}
        achievementsPath="/achievements"
        onRevert={onRevert}
      />,
    );
    await view.render();

    const revertBtn = Array.from(view.container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Hoàn tác hoàn thành"),
    );

    await act(async () => {
      revertBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Hoàn tác trạng thái hoàn thành khóa học");
    expect(bodyText).not.toContain("chứng nhận đã cấp sẽ được bảo lưu");

    await view.unmount();
  });
});
