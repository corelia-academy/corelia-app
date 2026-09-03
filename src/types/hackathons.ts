export type ContestStatus = "draft" | "published" | "running" | "ended";

export type ContestLocation = "online" | "offline" | "hybrid";

export interface HackathonHost {
  name: string;
  website_url?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
}

export interface HackathonSocialLinks {
  telegram?: string | null;
  x?: string | null;
  facebook?: string | null;
}

export interface HackathonPrizePool {
  /** Decimal string so fiat and token amounts retain their authored precision. */
  amount: string;
  currency: string;
  description_markdown?: string | null;
}

export interface HackathonTaxonomyOption {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  sort_order: number;
}

export interface HackathonTimelineItem {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  description_markdown?: string | null;
  sort_order: number;
}

export interface HackathonWinnerAward {
  id: string;
  project_id: string;
  label: string;
  sort_order: number;
}

export type ContestRegistrationStatus = "registered" | "pending" | "approved" | "rejected";

export type ContestScopedViewerRole =
  | "judge"
  | "co_host_viewer"
  | "co_organizer"
  | "partner_viewer"
  | "mentor"
  | "reviewer";

export type ContestInviteStatus = "pending" | "accepted" | "declined" | "revoked";

export interface ContestRubricWeights {
  product: number;
  technical: number;
  presentation: number;
  impact: number;
}

export interface ContestTrack {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean;
  prize_amount?: string | null;
  sort_order?: number;
  /**
   * Optional rubric definition (Phase 2+).
   * Current judging UI uses `rubric_weights` (4-criterion) and can ignore this for now.
   */
  rubric?: unknown;
}

export interface ContestRound {
  id: string;
  name: string;
  opens_at?: string | null;
  closes_at?: string | null;
  active?: boolean;
}

export interface ContestConfig {
  anonymous_judging?: boolean;
  auto_approve_registrations?: boolean;
}

export interface ContestJudgingConfig {
  active_round_id?: string | null;
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
  logo_path?: string | null;
  screenshot_paths?: string[];
  video_url?: string | null;
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

/** Optional richer document fields (jsonb) — forward-compatible with redesign schema. */
export type ContestHackathonResourceType =
  | "livestream"
  | "video"
  | "image"
  | "document"
  | "event"
  | "link";

export interface ContestHackathonResource {
  id: string;
  type: ContestHackathonResourceType;
  title: string;
  url: string;
  description?: string | null;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
  starts_at?: string | null;
  startsAt?: string | null;
  ends_at?: string | null;
  endsAt?: string | null;
  pinned?: boolean;
}

export interface ContestHackathonBadge {
  id: string;
  name: string;
  description: string;
  image_url?: string | null;
  imageUrl?: string | null;
  criteria?: string;
  custom_criteria_text?: string | null;
}

/** Host-side partners (sponsors / org allies) shown on the public hackathon page. */
export interface ContestOrganizationalPartner {
  /** Stable id for storage paths (e.g. uploaded logos). */
  id?: string;
  /** Display URL (signed URL when uploaded to app bucket; may be external https). */
  logo_url?: string | null;
  /** Storage path in `app` bucket when logo was uploaded from settings. */
  logo_path?: string | null;
  title: string;
  description?: string | null;
}

export interface ContestI18nContent {
  title?: string;
  tagline?: string;
  description?: string | null;
  rules?: string | null;
  prize_pool_summary?: string | null;
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
  organizational_partners?: ContestOrganizationalPartner[];
  tracks?: Array<Pick<ContestTrack, "id" | "name" | "description" | "active">>;
  rounds?: Array<Pick<ContestRound, "id" | "name" | "active">>;
  updated_at?: string;
  short_description?: string;
  description_markdown?: string | null;
  resources_markdown?: string | null;
  prize_description_markdown?: string | null;
  sectors?: HackathonTaxonomyOption[];
  tech_stacks?: HackathonTaxonomyOption[];
  timeline?: HackathonTimelineItem[];
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
  slug?: string | null;
  title: string;
  tagline: string;
  short_description?: string;
  description: string | null;
  description_markdown?: string | null;
  resources_markdown?: string | null;
  rules: string | null;
  status: ContestStatus;
  follower_count?: number;
  starts_at: string | null;
  ends_at: string | null;
  location: ContestLocation;
  mode?: ContestLocation;
  host?: HackathonHost;
  social_links?: HackathonSocialLinks;
  participants_count?: number;
  prize_pool?: HackathonPrizePool;
  sectors?: HackathonTaxonomyOption[];
  tech_stacks?: HackathonTaxonomyOption[];
  timeline?: HackathonTimelineItem[];
  winner_awards?: HackathonWinnerAward[];
  /** Wide banner on contest detail (hero) */
  cover_image_url?: string | null;
  /** Storage path for banner — used when replacing/deleting */
  cover_image_path?: string | null;
  /** Square-ish image for catalog cards & compact surfaces */
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline: string | null;
  /** Last moment participants may create/update contest submission (mirrors to projects). Empty = use `ends_at`. */
  submission_deadline: string | null;
  max_participants: number | null;
  judge_emails: string[];
  co_organizer_emails?: string[];
  co_host_viewer_emails: string[];
  partner_viewer_emails?: string[];
  mentor_emails?: string[];
  reviewer_emails?: string[];
  config?: ContestConfig;
  tracks?: ContestTrack[];
  rounds?: ContestRound[];
  judging?: ContestJudgingConfig;
  rubric_weights: ContestRubricWeights;
  metrics_snapshot: ContestMetricsSnapshot;
  published_leaderboard: ContestLeaderboardEntry[];
  winner_announcements: ContestWinner[];
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
  organizational_partners?: ContestOrganizationalPartner[];
  resources?: ContestHackathonResource[];
  badges?: ContestHackathonBadge[];
  official_course_id?: string | null;
  officialCourseId?: string | null;
  related_course_ids?: string[];
  relatedCourseIds?: string[];
  related_career_track_ids?: string[];
  relatedCareerTrackIds?: string[];
  track_id?: string | null;
  trackId?: string | null;
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContestInsert {
  slug?: string | null;
  title: string;
  tagline: string;
  short_description?: string;
  description?: string | null;
  description_markdown?: string | null;
  resources_markdown?: string | null;
  rules?: string | null;
  status?: ContestStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: ContestLocation;
  mode?: ContestLocation;
  host?: HackathonHost;
  social_links?: HackathonSocialLinks;
  prize_pool?: HackathonPrizePool;
  sectors?: HackathonTaxonomyOption[];
  tech_stacks?: HackathonTaxonomyOption[];
  timeline?: HackathonTimelineItem[];
  winner_awards?: HackathonWinnerAward[];
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline?: string | null;
  submission_deadline?: string | null;
  max_participants?: number | null;
  judge_emails?: string[];
  co_organizer_emails?: string[];
  co_host_viewer_emails?: string[];
  partner_viewer_emails?: string[];
  mentor_emails?: string[];
  reviewer_emails?: string[];
  config?: ContestConfig;
  tracks?: ContestTrack[];
  rounds?: ContestRound[];
  judging?: ContestJudgingConfig;
  rubric_weights?: ContestRubricWeights;
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
  organizational_partners?: ContestOrganizationalPartner[];
}

export interface ContestUpdate {
  slug?: string | null;
  title?: string;
  tagline?: string;
  short_description?: string;
  description?: string | null;
  description_markdown?: string | null;
  resources_markdown?: string | null;
  rules?: string | null;
  status?: ContestStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: ContestLocation;
  mode?: ContestLocation;
  host?: HackathonHost;
  social_links?: HackathonSocialLinks;
  prize_pool?: HackathonPrizePool;
  sectors?: HackathonTaxonomyOption[];
  tech_stacks?: HackathonTaxonomyOption[];
  timeline?: HackathonTimelineItem[];
  winner_awards?: HackathonWinnerAward[];
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  registration_deadline?: string | null;
  submission_deadline?: string | null;
  max_participants?: number | null;
  judge_emails?: string[];
  co_organizer_emails?: string[];
  co_host_viewer_emails?: string[];
  partner_viewer_emails?: string[];
  mentor_emails?: string[];
  reviewer_emails?: string[];
  config?: ContestConfig;
  tracks?: ContestTrack[];
  rounds?: ContestRound[];
  judging?: ContestJudgingConfig;
  rubric_weights?: ContestRubricWeights;
  metrics_snapshot?: ContestMetricsSnapshot;
  published_leaderboard?: ContestLeaderboardEntry[];
  winner_announcements?: ContestWinner[];
  prize_pool_summary?: string | null;
  prizes?: ContestPrizeEntry[];
  faqs?: ContestFaqEntry[];
  timeline_milestones?: ContestTimelineMilestone[];
  organizational_partners?: ContestOrganizationalPartner[];
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
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
  project_id?: string | null;
  team_name: string | null;
  team_members: string[];
  contestant_name: string | null;
  /** Track the submission belongs to (Phase 2 multi-track). */
  track_id?: string | null;
  track_ids?: string[];
  sector_ids?: string[];
  tech_stack_ids?: string[];
  /** Stable display id for anonymous judging UI (Phase 2). */
  display_id?: string | null;
  title: string;
  summary: string | null;
  demo_url: string | null;
  repo_url: string | null;
  slide_url: string | null;
  video_url: string | null;
  logo_path: string | null;
  screenshot_paths: string[];
  submitted_at: string;
  updated_at: string;
}

export interface ContestSubmissionInsert {
  project_id?: string;
  title: string;
  summary?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  slide_url?: string | null;
  video_url?: string | null;
  logo_path?: string | null;
  screenshot_paths?: string[];
  slug?: string | null;
  track_ids?: string[];
  sector_ids?: string[];
  tech_stack_ids?: string[];
}

/** Canonical vocabulary for new code; legacy Contest types remain source-compatible. */
export type Hackathon = Contest;
export type HackathonInsert = ContestInsert;
export type HackathonUpdate = ContestUpdate;
export type HackathonSubmission = ContestSubmission;
export type HackathonSubmissionInsert = ContestSubmissionInsert;

export interface ContestScore {
  id: string;
  contest_id: string;
  submission_id: string;
  /** Which judging round this score belongs to (Phase 2 multi-round). */
  round_id?: string | null;
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
