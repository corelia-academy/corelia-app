import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOgCard, publicOgMeta } from "./data.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

function database(rows: Record<string, Record<string, unknown> | null>): SupabaseClient {
  return {
    from(table: string) {
      let valid = true;
      const row = rows[table] ?? null;
      const query = {
        select() { return query; },
        eq(field: string, value: unknown) {
          const actual = field === "document->>slug" ? (row?.document as Record<string, unknown> | undefined)?.slug : row?.[field];
          if (actual !== value) valid = false;
          return query;
        },
        is(field: string, value: unknown) { if (row?.[field] !== value) valid = false; return query; },
        in(field: string, values: unknown[]) { if (!values.includes(row?.[field])) valid = false; return query; },
        ilike(field: string, value: string) { if (String(row?.[field] ?? "").toLowerCase() !== value.toLowerCase()) valid = false; return query; },
        maybeSingle: async () => ({ data: valid ? row : null, error: null }),
      };
      return query;
    },
    rpc: async () => ({ data: [{ skill: "Solana" }, { skill: "React" }], error: null }),
  } as unknown as SupabaseClient;
}

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (key: string) =>
  key === "CORELIA_APP_ORIGIN" ? "http://localhost:5173" : "http://127.0.0.1:54321" } }));
afterEach(() => vi.unstubAllGlobals());

describe("public OG DTO", () => {
  it("builds project card from public fields and excludes private projects", async () => {
    const project = { id: "project-id", slug: "demo", owner_id: "owner", title: "Dự án Việt",
      summary: "<b>Mô tả</b>", logo_path: "project-media/owner/project-id/logo/logo.png",
      hackathon_tech_stack_ids: [], hackathon_sector_ids: [], custom_sector_names: ["AI"],
      custom_tech_stack_names: [], updated_at: "2026-09-24T00:00:00Z", visibility: "public", blocked: false };
    const rows = { projects: project, public_profiles: { id: "owner", full_name: "Alice" } };
    const card = await loadOgCard(database(rows), "project", "demo");
    expect(card).toMatchObject({ title: "Dự án Việt", description: "Mô tả", tags: ["AI"], subtitle: "Alice" });
    expect(publicOgMeta(card!).imageUrl).toContain(card!.revision);
    const changed = await loadOgCard(database({ ...rows, projects: { ...project, summary: "Mô tả mới" } }), "project", "demo");
    expect(changed?.revision).not.toBe(card?.revision);
    const timestampOnly = await loadOgCard(database({ ...rows, projects: { ...project, updated_at: "2026-09-25T00:00:00Z" } }), "project", "demo");
    expect(timestampOnly?.revision).toBe(card?.revision);
    expect(await loadOgCard(database({ ...rows, projects: { ...project, visibility: "private" } }), "project", "demo")).toBeNull();
  });

  it("uses course slug canonical and rejects unpublished or archived courses", async () => {
    const course = { id: "course-id", slug: "course-slug", instructor_id: "owner", published: true,
      archived_at: null, data: { title: "Khóa học", short_description: "Mô tả", instructor_name: "Giảng viên" },
      updated_at: "2026-09-24T00:00:00Z" };
    const card = await loadOgCard(database({ courses: course }), "course", "course-slug");
    expect(card?.canonicalUrl).toBe("http://localhost:5173/courses/course-slug");
    expect(card?.subtitle).toBe("Giảng viên");
    expect(await loadOgCard(database({ courses: { ...course, published: false } }), "course", "course-slug")).toBeNull();
    expect(await loadOgCard(database({ courses: { ...course, archived_at: "2026-09-24T00:00:00Z" } }), "course", "course-slug")).toBeNull();
  });

  it("formats event dates and rejects draft events", async () => {
    const event = { id: "event-id", status: "running", updated_at: "2026-09-24T00:00:00Z",
      document: { slug: "hackathon", title: "Cuộc thi", host: { name: "Corelia" },
        starts_at: "2026-09-23T18:30:00Z", ends_at: "2026-09-25T10:00:00Z" } };
    const card = await loadOgCard(database({ hackathons: event }), "hackathon", "hackathon");
    expect(card?.dateLabel).toBe("24/09/2026 – 25/09/2026");
    expect(await loadOgCard(database({ hackathons: { ...event, status: "draft" } }), "hackathon", "hackathon")).toBeNull();
  });

  it("uses public skills and refuses external profile avatars", async () => {
    const profile = { id: "profile-id", username: "alice", ocid: null, full_name: "Alice",
      bio: "Học viên", avatar_url: "https://external.example/avatar.png", profile_public: true,
      updated_at: "2026-09-24T00:00:00Z" };
    const card = await loadOgCard(database({ public_profiles: profile }), "profile", "alice");
    expect(card).toMatchObject({ imagePath: null, subtitle: "@alice", tags: ["Solana", "React"] });
    const ownAvatar = await loadOgCard(database({ public_profiles: { ...profile,
      avatar_url: "http://127.0.0.1:54321/storage/v1/object/public/app/avatars/profile-id/avatar.png" } }), "profile", "alice");
    expect(ownAvatar?.imagePath).toBe("avatars/profile-id/avatar.png");
    const foreignAvatar = await loadOgCard(database({ public_profiles: { ...profile,
      avatar_url: "http://127.0.0.1:54321/storage/v1/object/public/app/avatars/another-id/avatar.png" } }), "profile", "alice");
    expect(foreignAvatar?.imagePath).toBeNull();
    expect(await loadOgCard(database({ public_profiles: { ...profile, profile_public: false } }), "profile", "alice")).toBeNull();
  });
});
