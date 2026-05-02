export type ContestStatus = "draft" | "published" | "running" | "ended";

export type ContestLocation = "online" | "offline" | "hybrid";

export type ContestRegistrationStatus = "pending" | "approved" | "rejected";

export type ContestScopedViewerRole = "judge" | "co_host_viewer";

export type ContestInviteStatus = "pending" | "accepted" | "declined" | "revoked";

export interface ContestRubricWeights {
  product: number;
  technical: number;
  presentation: number;
  impact: number;
}

export interface ContestMetricsSnapshot {
  registrations_total: number;
  pending_registrations: number;
  approved_registrations: number;
  rejected_registrations: number;
  submissions_total: number;
  scored_submissions: number;
  published_winners: number;
  updated_at: string | null;
}

export interface ContestLeaderboardEntry {
  submission_id: string;
  contestant_user_id: string;
  contestant_name: string | null;
  submission_title: string;
  average_score: number;
  score_count: number;
  rank: number;
  team_name: string | null;
  /** Copied from submission when publishing results — public gallery data */
  demo_url?: string | null;
  repo_url?: string | null;
  slide_url?: string | null;
  summary?: string | null;
}

export interface ContestPrizeEntry {
  rank_label: string;
  title: string;
  value_display?: string | null;
  description?: string | null;
}

export interface ContestFaqEntry {
  question: string;
  answer: string;
}

export interface ContestTimelineMilestone {
  title: string;
  at: string;
}

export interface ContestWinner {
  submission_id: string;
  contestant_user_id: string;
  contestant_name: string | null;
  submission_title: string;
  award_title: string;
  note: string | null;
  average_score: number | null;
  team_name: string | null;
  announced_at: string;
}

export interface Contest {
  id: string;
  title: string;
  tagline: string;
  description: string | null;
  rules: string | null;
  status: ContestStatus;
  starts_at: string | null;
  ends_at: string | null;
  location: ContestLocation;
  /** Wide banner on contest detail (hero) */
  cover_image_url?: string | null;
  /** Firebase Storage path for banner — used when replacing/deleting */
  cover_image_path?: string | null;
  /** Square-ish image for catalog cards & compact surfaces */
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline: string | null;
  max_participants: number | null;
  judge_emails: string[];
  co_host_viewer_emails: string[];
  rubric_weights: ContestRubricWeights;
  metrics_snapshot: ContestMetricsSnapshot;
  published_leaderboard: ContestLeaderboardEntry[];
  winner_announcements: ContestWinner[];
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContestInsert {
  title: string;
  tagline: string;
  description?: string | null;
  rules?: string | null;
  status?: ContestStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: ContestLocation;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline?: string | null;
  max_participants?: number | null;
  judge_emails?: string[];
  co_host_viewer_emails?: string[];
  rubric_weights?: ContestRubricWeights;
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
}

export interface ContestUpdate {
  title?: string;
  tagline?: string;
  description?: string | null;
  rules?: string | null;
  status?: ContestStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: ContestLocation;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline?: string | null;
  max_participants?: number | null;
  judge_emails?: string[];
  co_host_viewer_emails?: string[];
  rubric_weights?: ContestRubricWeights;
  metrics_snapshot?: ContestMetricsSnapshot;
  published_leaderboard?: ContestLeaderboardEntry[];
  winner_announcements?: ContestWinner[];
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
}

export interface ContestRegistration {
  id: string;
  contest_id: string;
  user_id: string;
  status: ContestRegistrationStatus;
  motivation: string | null;
  team_name: string | null;
  team_members: string[];
  contact_email: string | null;
  contact_phone: string | null;
  portfolio_url: string | null;
  user_full_name: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  applied_at: string;
  updated_at: string;
}

export interface ContestRegistrationInsert {
  motivation?: string | null;
  team_name?: string | null;
  team_members?: string[];
  contact_email?: string | null;
  contact_phone?: string | null;
  portfolio_url?: string | null;
  user_full_name?: string | null;
}

export interface ContestRegistrationReviewInput {
  status: Extract<ContestRegistrationStatus, "approved" | "rejected">;
  review_note?: string | null;
}

export interface ContestAccessInvite {
  id: string;
  contest_id: string;
  email: string;
  roles: ContestScopedViewerRole[];
  display_name: string | null;
  organization_name: string | null;
  note: string | null;
  status: ContestInviteStatus;
  invited_by: string;
  invited_at: string;
  responded_at: string | null;
}

export interface ContestAccessInviteInsert {
  email: string;
  roles: ContestScopedViewerRole[];
  display_name?: string | null;
  organization_name?: string | null;
  note?: string | null;
}

export interface ContestSubmission {
  id: string;
  contest_id: string;
  user_id: string;
  registration_id: string;
  team_name: string | null;
  team_members: string[];
  contestant_name: string | null;
  title: string;
  summary: string | null;
  demo_url: string | null;
  repo_url: string | null;
  slide_url: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface ContestSubmissionInsert {
  title: string;
  summary?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  slide_url?: string | null;
}

export interface ContestScore {
  id: string;
  contest_id: string;
  submission_id: string;
  judge_uid: string;
  judge_email: string | null;
  product_score: number;
  technical_score: number;
  presentation_score: number;
  impact_score: number;
  note: string | null;
  total_score: number;
  created_at: string;
  updated_at: string;
}

export interface ContestScoreInput {
  product_score: number;
  technical_score: number;
  presentation_score: number;
  impact_score: number;
  note?: string | null;
}

export interface ContestWinnerInput {
  submission_id: string;
  award_title: string;
  note?: string | null;
}
