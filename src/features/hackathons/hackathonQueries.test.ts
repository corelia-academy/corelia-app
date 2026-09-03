import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  getContestBySlug: vi.fn(),
  getPublicContestBySlug: vi.fn(),
  listContests: vi.fn(),
  listPublicContests: vi.fn(),
}));

vi.mock("@/lib/hackathons", () => ({
  ...service,
  getHackathonLocaleContent: vi.fn(),
  hasHackathonCoOrganizerAccess: vi.fn(),
}));

vi.mock("@/lib/projects", () => ({ listContestShowcasePortfolio: vi.fn() }));
vi.mock("@/lib/hackathonLearning", () => ({ resolveContestLearningLinks: vi.fn() }));

import {
  hackathonCatalogQueryOptions,
  hackathonPreviewQueryOptions,
  publicHackathonCatalogQueryOptions,
  publicHackathonDetailQueryOptions,
} from "./hackathonQueries";

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("hackathon public and private query boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listContests.mockResolvedValue([]);
    service.listPublicContests.mockResolvedValue([]);
    service.getContestBySlug.mockResolvedValue(null);
    service.getPublicContestBySlug.mockResolvedValue(null);
  });

  it("uses a viewer-independent query for the public catalog", async () => {
    const client = createClient();
    await client.fetchQuery(publicHackathonCatalogQueryOptions("vi"));

    expect(service.listPublicContests).toHaveBeenCalledWith("vi");
    expect(publicHackathonCatalogQueryOptions("vi").queryKey).toEqual([
      "hackathons",
      "catalog",
      "public",
      "vi",
    ]);
  });

  it("keeps the admin catalog scoped to its viewer", async () => {
    const viewer = { id: "admin-1" } as never;
    const client = createClient();
    await client.fetchQuery(hackathonCatalogQueryOptions(viewer, "vi"));

    expect(service.listContests).toHaveBeenCalledWith(viewer, "vi");
    expect(hackathonCatalogQueryOptions(viewer, "vi").queryKey).toContain("admin-1");
  });

  it("isolates draft previews from the public detail cache", async () => {
    const client = createClient();
    await client.fetchQuery(publicHackathonDetailQueryOptions("draft-demo", "vi"));
    await client.fetchQuery(hackathonPreviewQueryOptions("draft-demo", "vi", "admin-1"));

    expect(service.getPublicContestBySlug).toHaveBeenCalledWith("draft-demo", "vi");
    expect(service.getContestBySlug).toHaveBeenCalledWith("draft-demo", "vi");
    expect(publicHackathonDetailQueryOptions("draft-demo", "vi").queryKey)
      .not.toEqual(hackathonPreviewQueryOptions("draft-demo", "vi", "admin-1").queryKey);
    expect(hackathonPreviewQueryOptions("draft-demo", "vi", "admin-1").meta)
      .toMatchObject({ scope: "private", userId: "admin-1" });
  });
});
