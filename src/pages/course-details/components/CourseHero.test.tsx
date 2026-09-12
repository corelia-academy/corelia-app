// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { CourseHero } from "./CourseHero";
import { checkAndIssueCertificate } from "@/lib/courses";
import type { Course, Enrollment } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/i18n", () => ({ default: { language: "vi", t: (key: string) => key } }));
vi.mock("@/lib/courses", () => ({
  checkAndIssueCertificate: vi.fn(),
  courseHasCertificate: (course: Course) => course.has_certificate,
  getCoursePrimaryLocale: () => "vi",
  normalizeCourseLocale: () => "vi",
  pickCourseContentLocale: () => "vi",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const course = { id: "course", title: "Learning", has_certificate: true } as Course;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

function mount(enrollment: Enrollment | null) {
  const client = new QueryClient();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const claimed = vi.fn();
  cleanup = () => { act(() => root.unmount()); client.clear(); container.remove(); };
  act(() => root.render(<QueryClientProvider client={client}><CourseHero course={course} enrollment={enrollment} isPaidUpfront={false} isFreeWithPaidCertificate={false} previewLessons={[]} displayTotalDuration={0} curriculumCountLabel="12 lessons" onCertificateClaimed={claimed} /></QueryClientProvider>));
  return { client, container, claimed };
}

it.each([null, { user_id: "learner", completed_at: null }, { user_id: "learner", completed_at: "2025-01-01", certificate_issued_at: "2025-01-02" }])("does not offer a claim for anonymous, incomplete or already issued enrollment: %j", value => {
  const { container } = mount(value as Enrollment | null);
  expect(container.querySelector("button")).toBeNull();
  expect(checkAndIssueCertificate).not.toHaveBeenCalled();
});

it("offers historical completion a claim without consulting current lesson percentage and refreshes the vault", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof checkAndIssueCertificate>>) => void;
  vi.mocked(checkAndIssueCertificate).mockReturnValue(new Promise(done => { resolve = done; }));
  const { container, client, claimed } = mount({ user_id: "learner", course_id: "course", completed_at: "2025-01-01" } as Enrollment);
  const vaultKey = ["achievements", "vault", "learner", "vi"];
  client.setQueryData(vaultKey, {});
  const button = container.querySelector("button")!;
  expect(button.textContent).toBe("detail.courseDetail.claimCertificate");
  await act(async () => { button.click(); button.click(); });
  expect(checkAndIssueCertificate).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  await act(async () => resolve({ issued: true, certificate_issued_at: "2026-01-01", reason: "issued" }));
  expect(claimed).toHaveBeenCalledWith("2026-01-01");
  expect(client.getQueryState(vaultKey)?.isInvalidated).toBe(true);
});

it("keeps completion and allows retry when credential issuance fails", async () => {
  const enrollment = { user_id: "learner", course_id: "course", completed_at: "2025-01-01" } as Enrollment;
  vi.mocked(checkAndIssueCertificate).mockRejectedValue(new Error("Credential unavailable"));
  const { container, claimed } = mount(enrollment);
  const button = container.querySelector("button")!;
  await act(async () => button.click());
  expect(claimed).not.toHaveBeenCalled();
  expect(enrollment.completed_at).toBe("2025-01-01");
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(checkAndIssueCertificate).toHaveBeenCalledTimes(2);
});
