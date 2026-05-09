import i18n from "@/i18n";
import { getContestBySlug, setHackathonLocaleContent } from "@/lib/hackathons";
import { getCareerTrackBySlug, setCareerTrackLocaleContent } from "@/lib/careerTracks";
import { setProjectLocaleContent } from "@/lib/projects";

/**
 * Lightweight manual smoke helpers (dev console).
 * These are intentionally not wired into UI or migrations.
 *
 * Usage examples (in devtools console):
 * - await seedHackathonEn("my-hackathon-slug")
 * - await seedCareerTrackEn({ owner_scope: "corelia", slug: "frontend" })
 * - await seedProjectEn("project-uuid")
 */

export async function seedHackathonEn(slug: string) {
  const contest = await getContestBySlug(slug, "vi");
  if (!contest) throw new Error("Hackathon not found");
  await setHackathonLocaleContent(contest.id, "en", {
    title: `${contest.title} (EN)`,
    tagline: `${contest.tagline} (EN)`,
    description: contest.description ? `${contest.description}\n\n(English translation)` : null,
    rules: contest.rules ? `${contest.rules}\n\n(English translation)` : null,
  });
  // Refetch in EN to verify apply+fallback.
  return await getContestBySlug(slug, "en");
}

export async function seedCareerTrackEn(
  opts:
    | { owner_scope: "corelia"; slug: string }
    | { owner_scope: "instructor"; handle: string; slug: string },
) {
  const track = await getCareerTrackBySlug(opts, "vi");
  if (!track) throw new Error("Career track not found");
  await setCareerTrackLocaleContent(track.id, "en", {
    title: `${track.title} (EN)`,
    description: `${track.description}\n\n(English translation)`,
    what_youll_learn: track.what_youll_learn.map((s) => `${s} (EN)`),
    prerequisites: track.prerequisites.map((s) => `${s} (EN)`),
  });
  return {
    vi: track,
    en: await getCareerTrackBySlug(opts, "en"),
  };
}

export async function seedProjectEn(projectId: string) {
  await setProjectLocaleContent(projectId, "en", {
    title: "Project title (EN)",
    summary: "Project summary (EN)",
  });
  // Changing UI language should trigger refetch in pages that list projects.
  return { ok: true, language: i18n.language };
}

