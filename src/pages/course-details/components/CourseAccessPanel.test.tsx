// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CourseAccessPanel } from "./CourseAccessPanel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); });

function mount(props: { loading?: boolean; enrolled?: boolean }) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  act(() => {
    root.render(
      <CourseAccessPanel
        resolvedCourseId="course"
        enrolled={props.enrolled ?? false}
        progressPercent={40}
        isPublicEmptyCurriculum={false}
        hasStarted
        nextLesson={null}
        enrolling={false}
        loading={props.loading}
        onContinue={vi.fn()}
        onEnroll={vi.fn()}
      />,
    );
  });
  return container;
}

it("holds the CTA while enrollment is resolving instead of flashing Enroll", () => {
  const container = mount({ loading: true });
  expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  expect(container.querySelector("button")).toBeNull();
  expect(container.textContent).not.toContain("detail.accessPanel.enrollAndEnter");
});

it("shows the enroll CTA once enrollment is known", () => {
  const container = mount({ loading: false });
  expect(container.textContent).toContain("detail.accessPanel.enrollAndEnter");
});
