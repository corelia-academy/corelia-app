// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.confirm = () => true;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
(import.meta.env as Record<string, string>).VITE_SUPABASE_URL = "https://mock.supabase.co";

type QueryChain = {
  select: () => QueryChain;
  eq: () => QueryChain;
  in: () => QueryChain;
  order: () => Promise<{ data: unknown; error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then?: (resolve: (val: { data: unknown; error: null }) => void) => void;
};

const createMockChain = (data: unknown = []): QueryChain => {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => Promise.resolve({ data, error: null }),
    maybeSingle: () => Promise.resolve({ data, error: null }),
    then: (resolve) => resolve({ data, error: null }),
  };
  return chain;
};

// Module mocks for external integrations
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "test-auth-token", user: { id: "u-1" } } },
          error: null,
        }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    },
    supabasePublicClientKey: () => "mock-anon-key",
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? React.createElement("div", { "data-testid": "dialog-root" }, children) : null,
  DialogContent: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  DialogHeader: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  DialogTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("h2", { className }, children),
  DialogDescription: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("p", { className }, children),
  DialogFooter: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  DialogClose: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

vi.mock("@/lib/notificationInviteContext", () => ({
  fetchProjectInviteDisplayContextByProjectIds: vi.fn().mockResolvedValue({
    "proj-123": { projectTitle: "AI Hackathon Project", hackathonHref: "/hackathons/ai-2026" },
  }),
}));

vi.mock("@/lib/sectionQuestions", () => ({
  getSectionQuestions: vi.fn(),
  getLessonQuestions: vi.fn(),
}));

const mockTranslate = (key: string, optionsOrFallback?: unknown) => {
  if (typeof optionsOrFallback === "string") return optionsOrFallback;
  if (optionsOrFallback && typeof optionsOrFallback === "object") {
    const opts = optionsOrFallback as { defaultValue?: string; title?: string };
    return opts.defaultValue || opts.title || key;
  }
  return key;
};

const stableI18n = {
  t: mockTranslate,
  i18n: { changeLanguage: () => Promise.resolve() },
};

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => stableI18n,
  };
});

import { useLearnEnrollmentAccess } from "@/pages/learn/hooks/useLearnEnrollmentAccess";
import { QuestionGeneratorDialog } from "@/pages/instructor-course-edit/components/QuestionGeneratorDialog";
import { getSectionQuestions } from "@/lib/sectionQuestions";
import { peekProjectInviteByToken } from "@/lib/notifications";
import { getCareerTrackBySlug, listCareerTracks } from "@/lib/careerTracks";
import { CourseSpotlightSection } from "@/pages/course-details/components/CourseSpotlightSection";
import { invokeGenerateQuestions } from "@/lib/questionGenerator";
import { supabase } from "@/lib/supabase";
import type { CourseSection } from "@/types/courses";

/**
 * Standard React 19 test runner executing in a real DOM environment with act().
 * Uses real React DOM createRoot, useState, useEffect, and useRef without any internal monkey patching.
 */
function renderRealHook<P, R>(hookFn: (props: P) => R, initialProps: P) {
  let latestResult!: R;
  let currentProps = initialProps;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function TestComponent({ props }: { props: P }) {
    latestResult = hookFn(props);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TestComponent, { props: currentProps }),
      ),
    );
  });

  return {
    get current() {
      return latestResult;
    },
    rerender(nextProps: P) {
      currentProps = nextProps;
      act(() => {
        root.render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(TestComponent, { props: currentProps }),
          ),
        );
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      queryClient.clear();
      container.remove();
    },
  };
}

describe("Issue #343 Behavioral Regression Test Suite (Real DOM & Lifecycle Execution)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from = vi.fn().mockImplementation(() => createMockChain([]));
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("BUG-007: peekProjectInviteByToken implementation tests", () => {
    it("throws invalid_token for empty or whitespace-only token", async () => {
      await expect(peekProjectInviteByToken("   ")).rejects.toThrow("invalid_token");
    });

    it("throws expired when invite expires_at is in the past", async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "inv-123",
                project_id: "proj-123",
                status: "pending",
                role: "collaborator",
                expires_at: "2020-01-01T00:00:00Z",
                invitee_user_id: "u-1",
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(peekProjectInviteByToken("expired-token-123")).rejects.toThrow("expired");
    });

    it("throws not_actionable when invite status is already accepted", async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "inv-123",
                project_id: "proj-123",
                status: "accepted",
                role: "collaborator",
                expires_at: "2099-01-01T00:00:00Z",
                invitee_user_id: "u-1",
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(peekProjectInviteByToken("accepted-token-123")).rejects.toThrow("not_actionable");
    });

    it("throws wrong_account when authed user does not match invitee_user_id", async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "inv-123",
                project_id: "proj-123",
                status: "pending",
                role: "collaborator",
                expires_at: "2099-01-01T00:00:00Z",
                invitee_user_id: "different-user-999",
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(peekProjectInviteByToken("wrong-user-token")).rejects.toThrow("wrong_account");
    });

    it("returns populated preview for valid pending invite", async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "inv-123",
                project_id: "proj-123",
                status: "pending",
                role: "collaborator",
                expires_at: "2099-01-01T00:00:00Z",
                invitee_user_id: "u-1",
              },
              error: null,
            }),
          }),
        }),
      });

      const preview = await peekProjectInviteByToken("valid-token-123");
      expect(preview.id).toBe("inv-123");
      expect(preview.project_title).toBe("AI Hackathon Project");
      expect(preview.hackathon_href).toBe("/hackathons/ai-2026");
    });
  });

  describe("BUG-014: CourseSpotlightSection route verification", () => {
    it("renders spotlight card with href strictly pointing to /career", async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(CourseSpotlightSection, {
              resolvedCourseId: "course-123",
              courseTitle: "TypeScript Mastery",
              hasFullCourseAccess: false,
              nextLesson: null,
            }),
          ),
        );
      });

      const link = container.querySelector("a[href='/career']");
      expect(link).not.toBeNull();
      expect(container.querySelector("a[href='/hackathons']")).toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe("BUG-013: Career tracks multi-session cache & localization integrity", () => {
    it("invalidates list cache when track A is replaced by track B (same count)", async () => {
      let currentRows = [{ id: "track-A", slug: "track-a", title: "Track A", updated_at: "2026-08-01T00:00:00Z", published: true, courses: [] }];

      supabase.from = vi.fn().mockImplementation(() => createMockChain(currentRows));

      const first = await listCareerTracks("vi");
      expect(first[0]?.slug).toBe("track-a");

      currentRows = [{ id: "track-B", slug: "track-b", title: "Track B", updated_at: "2026-08-01T00:00:00Z", published: true, courses: [] }];

      const second = await listCareerTracks("vi");
      expect(second[0]?.slug).toBe("track-b");
    });

    it("retains translated title on cache hit in listCareerTracks", async () => {
      const trackRows = [{ id: "track-ai", slug: "ai-engineer", title: "Kỹ sư AI Fallback", updated_at: "2026-08-01T00:00:00Z", published: true, courses: [] }];
      const localeRows = [
        {
          career_track_id: "track-ai",
          locale: "vi",
          data: { title: "Kỹ sư AI" },
          updated_at: "2026-08-01T00:00:00Z",
        },
      ];

      supabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === "career_tracks") {
          return createMockChain(trackRows);
        }
        if (table === "career_track_locales") {
          return createMockChain(localeRows);
        }
        return createMockChain([]);
      });

      const first = await listCareerTracks("vi");
      expect(first[0]?.title).toBe("Kỹ sư AI");

      const second = await listCareerTracks("vi");
      expect(second[0]?.title).toBe("Kỹ sư AI");
    });

    it("refreshes list translation when another session updates only locale data (parent updated_at unchanged)", async () => {
      const trackRows = [{ id: "track-ai", slug: "ai-engineer", title: "AI Track", updated_at: "2026-08-01T00:00:00Z", published: true, courses: [] }];
      let currentLocaleRows = [
        {
          career_track_id: "track-ai",
          locale: "vi",
          data: { title: "Kỹ sư AI (Ban đầu)", updated_at: "2026-08-01T00:00:00Z" },
        },
      ];

      supabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === "career_tracks") {
          return createMockChain(trackRows);
        }
        if (table === "career_track_locales") {
          return createMockChain(currentLocaleRows);
        }
        return createMockChain([]);
      });

      const initial = await listCareerTracks("vi");
      expect(initial[0]?.title).toBe("Kỹ sư AI (Ban đầu)");

      // Writer B updates locale content and timestamp
      currentLocaleRows = [
        {
          career_track_id: "track-ai",
          locale: "vi",
          data: { title: "Kỹ sư AI (Đã cập nhật từ Writer B)", updated_at: "2026-08-01T12:00:00Z" },
        },
      ];

      const updated = await listCareerTracks("vi");
      expect(updated[0]?.title).toBe("Kỹ sư AI (Đã cập nhật từ Writer B)");
    });

    it("refreshes detail translation when another session updates only locale data", async () => {
      const trackRow = {
        id: "track-fe",
        slug: "frontend-dev",
        updated_at: "2026-08-01T00:00:00Z",
        published: true,
        title: "Frontend Track Fallback",
      };

      let localeUpdatedAt = "2026-08-01T00:00:00Z";
      let localeTitle = "Lộ trình Frontend (Gốc)";

      supabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === "career_tracks") {
          return createMockChain(trackRow);
        }
        if (table === "career_track_locales") {
          return createMockChain({
            career_track_id: "track-fe",
            locale: "vi",
            data: { title: localeTitle, updated_at: localeUpdatedAt },
          });
        }
        return createMockChain([]);
      });

      const initial = await getCareerTrackBySlug("frontend-dev", "vi");
      expect(initial?.title).toBe("Lộ trình Frontend (Gốc)");

      localeUpdatedAt = "2026-08-02T12:00:00Z";
      localeTitle = "Lộ trình Frontend (Mới từ Session B)";

      const updated = await getCareerTrackBySlug("frontend-dev", "vi");
      expect(updated?.title).toBe("Lộ trình Frontend (Mới từ Session B)");
    });
  });

  describe("BUG-011: Context isolation in useLearnEnrollmentAccess hook (Real React DOM Lifecycle)", () => {
    it("does not leak enrollment state between courses", async () => {
      const hook = renderRealHook(useLearnEnrollmentAccess, {
        courseId: "course-A",
        profileId: "user-1",
      });

      expect(hook.current.loading).toBe(true);
      await act(async () => {
        hook.current.setEnrollment({
          course_id: "course-A",
        } as never);
        hook.current.setEnrolled(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(hook.current.enrolled).toBe(true);
      expect(hook.current.hasFullCourseAccess).toBe(true);
      const setEnrollmentFromA = hook.current.setEnrollment;

      hook.rerender({
        courseId: "course-B",
        profileId: "user-1",
      });

      expect(hook.current.loading).toBe(true);
      expect(hook.current.enrolled).toBe(false);
      expect(hook.current.enrollment).toBeNull();
      expect(hook.current.hasFullCourseAccess).toBe(true);

      act(() => {
        setEnrollmentFromA({
          course_id: "course-A",
        } as never);
      });

      expect(hook.current.enrollment).toBeNull();

      hook.unmount();
    });

    it("does not leak enrollment across different accounts in the same course", async () => {
      const hook = renderRealHook(useLearnEnrollmentAccess, {
        courseId: "course-1",
        profileId: "user-alice",
      });

      await act(async () => {
        hook.current.setEnrollment({
          course_id: "course-1",
        } as never);
        hook.current.setEnrolled(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(hook.current.enrolled).toBe(true);
      expect(hook.current.hasFullCourseAccess).toBe(true);

      hook.rerender({
        courseId: "course-1",
        profileId: "user-bob",
      });

      expect(hook.current.enrolled).toBe(false);
      expect(hook.current.enrollment).toBeNull();
      expect(hook.current.hasFullCourseAccess).toBe(true);

      hook.unmount();
    });
  });

  describe("BUG-004: QuestionGeneratorDialog Component Lifecycle & State Isolation (Real DOM)", () => {
    const mockSectionA: CourseSection = {
      id: "sec-A",
      title: "Chương A",
      order: 1,
    };

    const mockSectionB: CourseSection = {
      id: "sec-B",
      title: "Chương B",
      order: 2,
    };

    it("Load A pending -> switch to B -> resolve A: Section B does not get overwritten by A", async () => {
      let resolveLoadA!: (val: unknown[]) => void;
      const loadAPromise = new Promise<unknown[]>((res) => {
        resolveLoadA = res;
      });

      let resolveLoadB!: (val: unknown[]) => void;
      const loadBPromise = new Promise<unknown[]>((res) => {
        resolveLoadB = res;
      });

      vi.mocked(getSectionQuestions).mockImplementation((_cId, sId) => {
        if (sId === "sec-A") return loadAPromise as never;
        if (sId === "sec-B") return loadBPromise as never;
        return Promise.resolve([]) as never;
      });

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // 1. Mount on Section A
      act(() => {
        root.render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(QuestionGeneratorDialog, {
              open: true,
              onOpenChange: () => {},
              courseId: "course-1",
              section: mockSectionA,
              locale: "vi",
              userId: "u-1",
            }),
          ),
        );
      });

      // 2. Switch to Section B while Section A load is pending
      act(() => {
        root.render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(QuestionGeneratorDialog, {
              open: true,
              onOpenChange: () => {},
              courseId: "course-1",
              section: mockSectionB,
              locale: "vi",
              userId: "u-1",
            }),
          ),
        );
      });

      // 3. Resolve Section B
      await act(async () => {
        resolveLoadB([
          {
            type: "mcq",
            question: "Câu hỏi của Section B",
            options: [
              { id: "a", text: "B1" },
              { id: "b", text: "B2" },
            ],
            correct_index: 0,
          },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(container.textContent).toContain("Câu hỏi của Section B");

      // 4. Resolve Section A late
      await act(async () => {
        resolveLoadA([
          {
            type: "mcq",
            question: "Câu hỏi của Section A đi lạc",
            options: [
              { id: "a", text: "A1" },
              { id: "b", text: "A2" },
            ],
            correct_index: 0,
          },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Invariant: Section B MUST NOT display Section A's questions
      expect(container.textContent).toContain("Câu hỏi của Section B");
      expect(container.textContent).not.toContain("Câu hỏi của Section A đi lạc");

      act(() => {
        root.unmount();
      });
      queryClient.clear();
      container.remove();
    });

    it("locks mutation when loadError exists", async () => {
      let rejectLoad!: (err: Error) => void;
      const loadPromise = new Promise<never>((_, rej) => {
        rejectLoad = rej;
      });

      vi.mocked(getSectionQuestions).mockReturnValue(loadPromise);

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      act(() => {
        root.render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(QuestionGeneratorDialog, {
              open: true,
              onOpenChange: () => {},
              courseId: "course-1",
              section: mockSectionA,
              locale: "vi",
              userId: "u-1",
            }),
          ),
        );
      });

      await act(async () => {
        rejectLoad(new Error("Database connection lost"));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(container.textContent).toContain("Database connection lost");

      const generateBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
        btn.textContent?.includes("courseEdit.questions.generate"),
      );
      expect(generateBtn?.disabled).toBe(true);

      act(() => {
        root.unmount();
      });
      queryClient.clear();
      container.remove();
    });
  });

  describe("BUG-001/002/003: AI Generator Frontend Invocation Error Handling", () => {
    it("throws 500 system error message on DB failure when calling generator", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Đã xảy ra lỗi hệ thống khi xử lý yêu cầu." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(
        invokeGenerateQuestions({
          courseId: "course-123",
          sectionId: "sec-456",
          locale: "vi",
          count: 5,
        }),
      ).rejects.toThrow("Đã xảy ra lỗi hệ thống khi xử lý yêu cầu.");
    });

    it("throws 404 error message when resource is not found", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Không tìm thấy khoá học." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(
        invokeGenerateQuestions({
          courseId: "course-non-existent",
          sectionId: "sec-456",
          locale: "vi",
          count: 5,
        }),
      ).rejects.toThrow("Không tìm thấy khoá học.");
    });
  });
});
