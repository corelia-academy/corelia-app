import type { Contest, ContestLeaderboardEntry } from "@/types/hackathons";
import type { ContestLinkedShowcaseProject } from "@/types/projects";

export function contestPublicShowcaseProjectsNavVisible(contest: Contest): boolean {
  if (!["published", "running", "ended"].includes(contest.status)) return false;
  const submissionsTotal = Number(contest.metrics_snapshot?.submissions_total ?? 0);
  return submissionsTotal > 0 || (contest.published_leaderboard?.length ?? 0) > 0;
}

export type ContestShowcaseDisplayRow = {
  key: string;
  submissionId: string;
  /** Row UUID on `projects` when synced; null when leaderboard entry has no linked project row yet. */
  projectId: string | null;
  ownerId: string | null;
  likeCount: number;
  title: string;
  summary: string | null;
  demo_url: string | null;
  repo_url: string | null;
  slide_url: string | null;
  screenshot_url: string | null;
  cover_image_url: string | null;
  video_url: string | null;
  rank?: number;
  average_score?: number;
  score_count?: number;
  contestant_fallback: string | null;
};

export function buildContestShowcaseRows(
  projects: ContestLinkedShowcaseProject[],
  leaderboard: ContestLeaderboardEntry[],
): ContestShowcaseDisplayRow[] {
  const bySubId = new Map<string, ContestLinkedShowcaseProject>();
  for (const p of projects) {
    if (p.source_submission_id) bySubId.set(p.source_submission_id, p);
  }

  if (leaderboard.length === 0) {
    return [...projects]
      .sort((a, b) =>
        String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
      )
      .map((proj) => ({
        key: proj.id,
        submissionId: proj.source_submission_id ?? proj.id,
        projectId: proj.id,
        ownerId: proj.owner_id,
        likeCount: Number(proj.like_count ?? 0),
        title: proj.title,
        summary: proj.summary,
        demo_url: proj.demo_url,
        repo_url: proj.repo_url,
        slide_url: proj.slide_url,
        screenshot_url: proj.screenshot_url,
        cover_image_url: proj.cover_image_url,
        video_url: proj.video_url,
        contestant_fallback: null,
      }));
  }

  const usedSubmissionIds = new Set<string>();
  const rows: ContestShowcaseDisplayRow[] = [];

  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank);
  for (const entry of sorted) {
    usedSubmissionIds.add(entry.submission_id);
    const proj = bySubId.get(entry.submission_id);
    const title = (proj?.title?.trim() || entry.submission_title).trim() || entry.submission_title;
    rows.push({
      key: entry.submission_id,
      submissionId: entry.submission_id,
      projectId: proj?.id ?? null,
      ownerId: proj?.owner_id ?? null,
      likeCount: Number(proj?.like_count ?? 0),
      title,
      summary: proj?.summary ?? entry.summary ?? null,
      demo_url: proj?.demo_url ?? entry.demo_url ?? null,
      repo_url: proj?.repo_url ?? entry.repo_url ?? null,
      slide_url: proj?.slide_url ?? entry.slide_url ?? null,
      screenshot_url: proj?.screenshot_url ?? entry.screenshot_url ?? null,
      cover_image_url:
        proj?.cover_image_url ??
        entry.cover_image_url ??
        proj?.screenshot_url ??
        entry.screenshot_url ??
        null,
      video_url: proj?.video_url ?? entry.video_url ?? null,
      rank: entry.rank,
      average_score: entry.average_score,
      score_count: entry.score_count,
      contestant_fallback:
        entry.contestant_name || entry.contestant_user_id || null,
    });
  }

  const orphans = projects.filter(
    (p) => p.source_submission_id && !usedSubmissionIds.has(p.source_submission_id),
  );
  orphans.sort((a, b) =>
    String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
  );

  for (const proj of orphans) {
    const sid = proj.source_submission_id ?? proj.id;
    rows.push({
      key: proj.id,
      submissionId: sid,
      projectId: proj.id,
      ownerId: proj.owner_id,
      likeCount: Number(proj.like_count ?? 0),
      title: proj.title,
      summary: proj.summary,
      demo_url: proj.demo_url,
      repo_url: proj.repo_url,
      slide_url: proj.slide_url,
      screenshot_url: proj.screenshot_url,
      cover_image_url: proj.cover_image_url,
      video_url: proj.video_url,
      contestant_fallback: null,
    });
  }

  return rows;
}
