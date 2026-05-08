import type { Contest } from "@/types/contests";

export function contestFromRow(
  row: {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    document: Record<string, unknown> | null;
  },
  profileId: string,
): Contest {
  const doc = row.document ?? {};
  return {
    id: row.id,
    title: String(doc.title ?? ""),
    tagline: String(doc.tagline ?? ""),
    description: (doc.description as string | null) ?? null,
    rules: (doc.rules as string | null) ?? null,
    status: (doc.status as Contest["status"]) ?? (row.status as Contest["status"]),
    starts_at: (doc.starts_at as string | null) ?? null,
    ends_at: (doc.ends_at as string | null) ?? null,
    location: (doc.location as Contest["location"]) ?? "hybrid",
    cover_image_url: (doc.cover_image_url as string | null) ?? null,
    cover_image_path: (doc.cover_image_path as string | null) ?? null,
    thumbnail_url: (doc.thumbnail_url as string | null) ?? null,
    thumbnail_path: (doc.thumbnail_path as string | null) ?? null,
    registration_deadline: (doc.registration_deadline as string | null) ?? null,
    max_participants: (doc.max_participants as number | null) ?? null,
    judge_emails: Array.isArray(doc.judge_emails) ? (doc.judge_emails as string[]) : [],
    co_host_viewer_emails: Array.isArray(doc.co_host_viewer_emails)
      ? (doc.co_host_viewer_emails as string[])
      : [],
    rubric_weights: (doc.rubric_weights as Contest["rubric_weights"]) ?? {
      product: 25,
      technical: 25,
      presentation: 25,
      impact: 25,
    },
    metrics_snapshot: (doc.metrics_snapshot as Contest["metrics_snapshot"]) ?? {
      registrations_total: 0,
      pending_registrations: 0,
      approved_registrations: 0,
      rejected_registrations: 0,
      submissions_total: 0,
      scored_submissions: 0,
      published_winners: 0,
      updated_at: null,
    },
    published_leaderboard: Array.isArray(doc.published_leaderboard)
      ? (doc.published_leaderboard as Contest["published_leaderboard"])
      : [],
    winner_announcements: Array.isArray(doc.winner_announcements)
      ? (doc.winner_announcements as Contest["winner_announcements"])
      : [],
    prize_pool_summary: (doc.prize_pool_summary as string | null) ?? null,
    prizes: Array.isArray(doc.prizes) ? (doc.prizes as Contest["prizes"]) : [],
    faqs: Array.isArray(doc.faqs) ? (doc.faqs as Contest["faqs"]) : [],
    timeline_milestones: Array.isArray(doc.timeline_milestones)
      ? (doc.timeline_milestones as Contest["timeline_milestones"])
      : [],
    created_by: String(doc.created_by ?? profileId),
    updated_by: String(doc.updated_by ?? profileId),
    created_at: String(doc.created_at ?? row.created_at),
    updated_at: String(doc.updated_at ?? row.updated_at),
  };
}
