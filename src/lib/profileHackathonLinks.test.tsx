// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockProjects = [
  {
    id: "project-1",
    slug: "my-project",
    owner_id: "author-user-1",
    title: "Summer Project With Slug",
    summary: "A great project from summer hackathon",
    source_type: "hackathon",
    source_id: "hack-uuid-1",
    visibility: "public",
    updated_at: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "project-2",
    slug: "orphan-project",
    owner_id: "author-user-1",
    title: "Orphan Project Without Slug",
    summary: "Hackathon has no slug in document",
    source_type: "hackathon",
    source_id: "hack-uuid-2",
    visibility: "public",
    updated_at: "2026-03-02T00:00:00.000Z",
  },
  {
    id: "project-3",
    slug: "course-project",
    owner_id: "author-user-1",
    title: "Course Project",
    summary: "From course",
    source_type: "course",
    source_id: "course-uuid-1",
    visibility: "public",
    updated_at: "2026-03-03T00:00:00.000Z",
  },
];

const mockHackathonRows = [
  {
    id: "hack-uuid-1",
    document: { slug: "summer-code-challenge", title: "Summer Code Challenge" },
    status: "published",
    created_by: "author-user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "hack-uuid-2",
    document: { title: "No Slug Hackathon" },
    status: "published",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "b2dfc032-6e27-46cb-8b54-fa9a1bfaee31",
    document: { slug: "uuid-fallback-event", title: "UUID Fallback Event" },
    status: "published",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const mockPublicProfile: PublicProfile = {
  id: "author-user-1",
  username: "testuser",
  handle: "testuser",
  display_name: "Test User",
  avatar_url: null,
  bio: null,
  profile_public: true,
  role: "user",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as unknown as PublicProfile;

const queryCalls: { table: string; col?: string; val?: unknown }[] = [];

vi.mock("@/i18n", () => ({ default: { language: "vi", resolvedLanguage: "vi" } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "vi", resolvedLanguage: "vi" },
  }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: { id: "test-user-1" } }),
}));
vi.mock("@/features/projects/projectSocialQueries", () => ({
  projectHeartsQueryOptions: () => ({
    queryKey: ["project-hearts"],
    queryFn: async () => new Set<string>(),
  }),
  projectHeartQueryOptions: () => ({
    queryKey: ["project-heart"],
    queryFn: async () => false,
  }),
}));
vi.mock("@/lib/coreliaEdgeApi", () => ({
  invokeCoreliaApi: vi.fn(),
  callCoreliaApi: vi.fn(),
  coreliaEdgeUrl: vi.fn((path: string) => `https://example.com/edge/${path}`),
}));
vi.mock("@/lib/storage", () => ({ deleteStorageObjectByPath: vi.fn() }));
vi.mock("@/lib/profile", () => ({
  getProfileForUser: vi.fn(async () => ({ id: "admin-1", role: "admin" })),
}));

vi.mock("@/lib/supabase", () => {
  const fromMock = vi.fn((table: string) => {
    let currentFilterCol: string | undefined;
    let currentFilterVal: unknown;

    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      order: vi.fn(() => {
        const res = table === "hackathons"
          ? { data: mockHackathonRows, error: null }
          : { data: mockProjects, error: null };
        const p = Promise.resolve(res);
        return Object.assign(p, {
          in: vi.fn(() => Promise.resolve(res)),
          range: vi.fn(() => Promise.resolve(res)),
          limit: vi.fn(() => Promise.resolve(res)),
        });
      }),
      in: vi.fn((col: string, vals: string[]) => {
        queryCalls.push({ table, col, val: vals });
        if (table === "hackathons" && col === "id") {
          const matched = mockHackathonRows.filter((r) => vals.includes(r.id));
          return Promise.resolve({ data: matched, error: null });
        }
        if (table === "hackathons" && col === "status") {
          const p = Promise.resolve({ data: mockHackathonRows, error: null });
          return Object.assign(p, {
            order: vi.fn(() => Promise.resolve({ data: mockHackathonRows, error: null })),
          });
        }
        return chain;
      }),
      eq: vi.fn((col: string, val?: unknown) => {
        currentFilterCol = col;
        currentFilterVal = val;
        queryCalls.push({ table, col, val });

        if (table === "projects" && col === "owner_id") {
          return {
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
            })),
          };
        }
        if (table === "project_collaborators") {
          return {
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          };
        }
        if (table === "hackathon_submissions" && col === "user_id") {
          return Promise.resolve({
            data: [
              {
                hackathon_id: "hack-uuid-1",
              },
            ],
            error: null,
          });
        }
        return chain;
      }),
      maybeSingle: vi.fn(async () => {
        if (table === "hackathons") {
          if (currentFilterCol === "document->>slug") {
            const match = mockHackathonRows.find(
              (r) => r.document && (r.document as Record<string, unknown>).slug === currentFilterVal,
            );
            return { data: match ?? null, error: null };
          }
          if (currentFilterCol === "id") {
            const match = mockHackathonRows.find((r) => r.id === currentFilterVal);
            return { data: match ?? null, error: null };
          }
          return { data: mockHackathonRows[0], error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });

  return {
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from: fromMock,
    },
  };
});

import { UserProfileProjectsSection } from "@/pages/users/user-profile/components/UserProfileProjectsSection";
import { UserProfileContestsSection } from "@/pages/users/user-profile/components/UserProfileContestsSection";
import { getContestBySlug, listPublicProfileContestPortfolio } from "./hackathons";
import type { PublicProfile } from "@/types/database";

function renderWithProviders(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{element}</MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("issue #393 - profile hackathon links regression behavior", () => {
  beforeEach(() => {
    queryCalls.length = 0;
  });

  it("renders UserProfileProjectsSection and verifies canonical slug href and UUID fallback href in DOM", async () => {
    const { container, cleanup } = renderWithProviders(
      <UserProfileProjectsSection profile={mockPublicProfile} />,
    );
    await settle();

    const anchorElements = Array.from(container.querySelectorAll("a"));
    const hrefs = anchorElements.map((a) => a.getAttribute("href"));

    // Project 1 has hackathon_slug resolved from hackathons table -> rendered href uses slug
    expect(hrefs).toContain("/hackathons/summer-code-challenge/overview");

    // Project 2 has source_id but no slug in document -> rendered href safely falls back to UUID
    expect(hrefs).toContain("/hackathons/hack-uuid-2/overview");

    // Project 3 is a course project -> rendered href uses course route
    expect(hrefs).toContain("/courses/course-uuid-1");

    await cleanup();
  });

  it("renders UserProfileContestsSection and verifies contest participation and organized slug hrefs in DOM", async () => {
    const { container, cleanup } = renderWithProviders(
      <UserProfileContestsSection profile={mockPublicProfile} isSelf={true} />,
    );
    await settle();

    const anchorElements = Array.from(container.querySelectorAll("a"));
    const hrefs = anchorElements.map((a) => a.getAttribute("href"));

    // User's organized and participated contest hack-uuid-1 has slug summer-code-challenge
    expect(hrefs).toContain("/hackathons/summer-code-challenge/overview");

    await cleanup();
  });

  it("proves getContestBySlug fallback path: fails slug query first, then executes id fallback query", async () => {
    const targetUuid = "b2dfc032-6e27-46cb-8b54-fa9a1bfaee31";
    const contest = await getContestBySlug(targetUuid, "vi");

    expect(contest).not.toBeNull();
    expect(contest?.id).toBe(targetUuid);
    expect(contest?.slug).toBe("uuid-fallback-event");

    // Prove the actual query flow:
    // 1. First queried hackathons table by document->>slug with targetUuid
    const slugQueryCall = queryCalls.find(
      (c) => c.table === "hackathons" && c.col === "document->>slug" && c.val === targetUuid,
    );
    expect(slugQueryCall).toBeDefined();

    // 2. Since slug query returned null, fallback queried hackathons table by id with targetUuid
    const idQueryCall = queryCalls.find(
      (c) => c.table === "hackathons" && c.col === "id" && c.val === targetUuid,
    );
    expect(idQueryCall).toBeDefined();

    // Ensure slug query happened before id query
    const slugIndex = queryCalls.indexOf(slugQueryCall!);
    const idIndex = queryCalls.indexOf(idQueryCall!);
    expect(slugIndex).toBeLessThan(idIndex);
  });

  it("verifies listPublicProfileContestPortfolio queries hackathon_submissions table instead of legacy contest_submissions", async () => {
    const portfolio = await listPublicProfileContestPortfolio("author-user-1", true, "vi");
    expect(portfolio.participations.length).toBe(1);
    expect(portfolio.participations[0].id).toBe("hack-uuid-1");

    const submissionQuery = queryCalls.find(
      (c) => c.table === "hackathon_submissions" && c.col === "user_id",
    );
    expect(submissionQuery).toBeDefined();

    const legacyQuery = queryCalls.find((c) => c.table === "contest_submissions");
    expect(legacyQuery).toBeUndefined();
  });
});
