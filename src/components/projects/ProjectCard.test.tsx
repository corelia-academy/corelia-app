// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicProjectTeamMember } from "@/lib/projectCollaboration";
import type { Project } from "@/types/projects";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "projects.team.moreMembers" ? `${options?.count} more members` : key,
  }),
}));
vi.mock("@/components/projects/ProjectSocialBlock", () => ({ ProjectSocialBlock: () => null }));
vi.mock("@/lib/projects", () => ({ getProjectCoverImageUrl: () => null }));
vi.mock("@/lib/projectTaxonomy", () => ({ projectTaxonomyNames: () => [] }));

import { ProjectCard } from "./ProjectCard";

const project = {
  id: "project-1",
  slug: "demo",
  owner_id: "owner-1",
  title: "Demo project",
  summary: "Summary",
  demo_url: null,
  repo_url: null,
  slide_url: null,
  video_url: null,
  logo_path: null,
  screenshot_paths: [],
  visibility: "public",
  source_type: "standalone",
  source_id: null,
  source_submission_id: null,
  hackathon_track_ids: [],
  hackathon_sector_ids: [],
  hackathon_tech_stack_ids: [],
  custom_sector_names: [],
  custom_tech_stack_names: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} satisfies Project;

function member(id: string): PublicProjectTeamMember {
  return {
    id,
    user_id: id,
    username: id,
    full_name: `Member ${id}`,
    avatar_url: null,
    added_at: "2026-01-01T00:00:00Z",
  };
}

function renderCard(teamMembers: PublicProjectTeamMember[] = []) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <ProjectCard
          project={project}
          ownerLabel="Owner Name"
          ownerHandle="owner"
          teamMembers={teamMembers}
        />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

describe("ProjectCard team preview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the owner avatar and name when the owner is the only builder", () => {
    const { container, root } = renderCard();
    expect(container.textContent).toContain("Owner Name");
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(1);
    expect(container.querySelector('a[href="/@owner"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("shows three avatars and an accessible overflow count for larger teams", () => {
    const { container, root } = renderCard([member("member-1"), member("member-2"), member("member-3"), member("member-4")]);
    expect(container.querySelectorAll('[data-slot="avatar-group"] [data-slot="avatar"]')).toHaveLength(3);
    const overflow = container.querySelector('[data-slot="avatar-group-count"]');
    expect(overflow?.textContent).toBe("+2");
    expect(overflow?.getAttribute("aria-label")).toBe("2 more members");
    act(() => root.unmount());
  });
});
