// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import CourseDetail from "./CourseDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  sync: vi.fn(),
  credential: vi.fn(),
  setEnrollment: vi.fn(),
  courses: {
    a: { id: "a", title: "A", published: true },
    b: { id: "b", title: "B", published: true },
  } as Record<string, { id: string; title: string; published: boolean }>,
}));

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({
    user: { id: "learner" },
    profile: { id: "learner" },
    isAuthenticated: true,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/courses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/courses")>()),
  courseHasCertificate: () => false,
  ensureEnrollmentForProgress: async () => null,
  syncCourseCompletion: (...args: unknown[]) => state.sync(...args),
  checkAndIssueCertificate: vi.fn(),
  sortLessonsByCurriculum: () => [],
  isLessonPublishedForLearners: () => true,
  revertCourseCompletion: vi.fn(),
}));

vi.mock("@/lib/credentialsEdge", () => ({
  invokeCheckCourseCredential: (...args: unknown[]) => state.credential(...args),
}));

vi.mock("@/features/learning/invalidateLearningProgress", () => ({
  invalidateLearningProgress: vi.fn(),
}));

vi.mock("./hooks/useCourseLoad", () => ({
  useCourseLoad: ({ idOrSlug }: { idOrSlug: string }) => ({
    course: state.courses[idOrSlug],
    resolvedCourseId: idOrSlug,
    lessons: [],
    sections: [],
    loading: false,
    error: null,
  }),
}));

vi.mock("./hooks/useCourseEnrollmentAccess", () => ({
  useCourseEnrollmentAccess: () => ({
    enrollment: null,
    hasFullCourseAccess: true,
    setEnrollment: state.setEnrollment,
    setEnrolled: vi.fn(),
  }),
}));

vi.mock("./hooks/useCourseProgress", () => ({
  useCourseProgress: ({ resolvedCourseId }: { resolvedCourseId: string }) => ({
    progressPercent: resolvedCourseId === "a" ? 100 : 0,
    completedIds: new Set(),
    refresh: vi.fn(),
    nextLesson: null,
  }),
}));

vi.mock("./hooks/useSpotlightContests", () => ({
  useSpotlightContests: () => [],
}));

vi.mock("./hooks/useInstructorProfile", () => ({
  useInstructorProfile: () => ({ profile: null }),
}));

vi.mock("./components/CourseHero", () => ({
  CourseHero: () => <div data-testid="hero" />,
}));

vi.mock("./components/CourseLanguagePanel", () => ({
  CourseLanguagePanel: () => null,
}));

vi.mock("@/components/courses/CourseCompletionCertificatePanel", () => ({
  CourseCompletionCertificatePanel: () => <p data-testid="completed">Completed Panel</p>,
}));

vi.mock("./components/CourseLearningOutcomes", () => ({
  CourseLearningOutcomes: () => null,
}));

vi.mock("./components/CourseSkills", () => ({
  CourseSkills: () => null,
}));

vi.mock("./components/CourseDescription", () => ({
  CourseDescription: () => null,
}));

vi.mock("./components/CourseCurriculumSection", () => ({
  CourseCurriculumSection: () => null,
}));

vi.mock("./components/CourseInstructorCard", () => ({
  CourseInstructorCard: () => null,
}));

vi.mock("./components/CourseDraftBanner", () => ({
  CourseDraftBanner: () => null,
}));

vi.mock("@/features/followers/components/FollowerPreview", () => ({
  FollowerPreview: () => null,
}));

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  vi.clearAllMocks();
});

it.each([false, true])(
  "CourseDetail resets completion state when switching courses (switch=%s)",
  async (switchCourse) => {
    let resolveCompletion!: (value: { completed: boolean; completed_at: string }) => void;
    state.sync.mockReturnValue(
      new Promise((resolve) => {
        resolveCompletion = resolve;
      }),
    );
    state.credential.mockResolvedValue({ reason: "no_credential" });

    const router = createMemoryRouter(
      [{ path: "/courses/:id", element: <CourseDetail /> }],
      { initialEntries: ["/courses/a"] },
    );
    const client = new QueryClient();
    const host = document.createElement("div");
    const root = createRoot(host);
    cleanup = () => {
      act(() => root.unmount());
      router.dispose();
      client.clear();
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
    });

    expect(state.sync).toHaveBeenCalledWith("learner", "a");

    if (switchCourse) {
      await act(async () => {
        await router.navigate("/courses/b");
      });
    }

    await act(async () => {
      resolveCompletion({ completed: true, completed_at: "2026-09-16T00:00:00Z" });
    });

    expect(Boolean(host.querySelector('[data-testid="completed"]'))).toBe(!switchCourse);
    expect(state.credential).toHaveBeenCalledTimes(switchCourse ? 0 : 1);
  },
);
