import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { deleteStorageObjectByPath } from "@/lib/storage";
import { getCurrentProfile } from "@/lib/profile";
import {
  canManageContests,
  canReviewContestApplications,
  canScoreContest,
} from "@/lib/permissions";
import type {
  Contest,
  ContestAccessInvite,
  ContestAccessInviteInsert,
  ContestFaqEntry,
  ContestInsert,
  ContestLeaderboardEntry,
  ContestMetricsSnapshot,
  ContestPrizeEntry,
  ContestRegistration,
  ContestRegistrationInsert,
  ContestRegistrationReviewInput,
  ContestRegistrationStatus,
  ContestRubricWeights,
  ContestScore,
  ContestScoreInput,
  ContestSubmission,
  ContestSubmissionInsert,
  ContestTimelineMilestone,
  ContestUpdate,
  ContestWinner,
  ContestWinnerInput,
} from "@/types/contests";

const CONTESTS = "contests";
const CONTEST_REGISTRATIONS = "contest_registrations";
const CONTEST_ACCESS_INVITES = "contest_access_invites";
const CONTEST_SUBMISSIONS = "contest_submissions";
const CONTEST_SCORES = "contest_scores";
const PUBLIC_CONTEST_STATUSES: Contest["status"][] = ["published", "running", "ended"];

function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeEmailList(values: string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => sanitizeEmail(value)).filter(Boolean)),
  );
}

function sanitizeStringList(values: string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function sanitizePrizeEntries(values: ContestPrizeEntry[] | undefined): ContestPrizeEntry[] {
  if (!values?.length) return [];
  return values
    .map((p) => ({
      rank_label: p.rank_label.trim(),
      title: p.title.trim(),
      value_display: p.value_display?.trim() || null,
      description: p.description?.trim() || null,
    }))
    .filter((p) => p.rank_label.length > 0 && p.title.length > 0);
}

function sanitizeFaqEntries(values: ContestFaqEntry[] | undefined): ContestFaqEntry[] {
  if (!values?.length) return [];
  return values
    .map((f) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
    }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0);
}

function sanitizeTimelineMilestones(
  values: ContestTimelineMilestone[] | undefined,
): ContestTimelineMilestone[] {
  if (!values?.length) return [];
  const cleaned = values
    .map((m) => ({
      title: m.title.trim(),
      at: m.at.trim(),
    }))
    .filter((m) => m.title.length > 0 && m.at.length > 0);
  cleaned.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return cleaned;
}

function contestRegistrationId(contestId: string, userId: string): string {
  return `${contestId}_${userId}`;
}

function contestInviteId(contestId: string, email: string): string {
  return `${contestId}_${sanitizeEmail(email)}`;
}

function contestSubmissionId(contestId: string, userId: string): string {
  return `${contestId}_${userId}`;
}

function contestScoreId(submissionId: string, judgeUid: string): string {
  return `${submissionId}_${judgeUid}`;
}

function emptyMetricsSnapshot(): ContestMetricsSnapshot {
  return {
    registrations_total: 0,
    pending_registrations: 0,
    approved_registrations: 0,
    rejected_registrations: 0,
    submissions_total: 0,
    scored_submissions: 0,
    published_winners: 0,
    updated_at: null,
  };
}

function defaultRubricWeights(): ContestRubricWeights {
  return {
    product: 25,
    technical: 25,
    presentation: 25,
    impact: 25,
  };
}

function normalizeContest(data: Contest): Contest {
  return {
    ...data,
    judge_emails: sanitizeEmailList(data.judge_emails),
    co_host_viewer_emails: sanitizeEmailList(data.co_host_viewer_emails),
    rubric_weights: data.rubric_weights ?? defaultRubricWeights(),
    metrics_snapshot: data.metrics_snapshot ?? emptyMetricsSnapshot(),
    published_leaderboard: data.published_leaderboard ?? [],
    winner_announcements: data.winner_announcements ?? [],
    cover_image_url: data.cover_image_url?.trim() || null,
    cover_image_path: data.cover_image_path?.trim() || null,
    thumbnail_url: data.thumbnail_url?.trim() || null,
    thumbnail_path: data.thumbnail_path?.trim() || null,
    prize_pool_summary: data.prize_pool_summary?.trim() || null,
    prizes: sanitizePrizeEntries(data.prizes),
    faqs: sanitizeFaqEntries(data.faqs),
    timeline_milestones: sanitizeTimelineMilestones(data.timeline_milestones ?? []),
  };
}

function normalizeRegistration(data: ContestRegistration): ContestRegistration {
  return {
    ...data,
    team_members: sanitizeStringList(data.team_members),
  };
}

async function requireCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  return user;
}

async function requireContestManager(): Promise<{ uid: string }> {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile();
  if (!canManageContests(profile)) {
    throw new Error("Bạn không có quyền quản lý cuộc thi.");
  }
  return { uid: user.uid };
}

async function requireContestScorer(contestId: string): Promise<Contest> {
  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([getCurrentProfile(), getContest(contestId)]);
  if (!contest) throw new Error("Không tìm thấy cuộc thi.");
  if (!canScoreContest(contest, profile, user.email)) {
    throw new Error("Bạn không có quyền chấm điểm contest này.");
  }
  return contest;
}

async function requireContestReviewer(contestId: string): Promise<Contest> {
  await requireCurrentUser();
  const [profile, contest] = await Promise.all([getCurrentProfile(), getContest(contestId)]);
  if (!contest) throw new Error("Không tìm thấy cuộc thi.");
  if (!canReviewContestApplications(contest, profile)) {
    throw new Error("Bạn không có quyền duyệt hồ sơ contest này.");
  }
  return contest;
}

export async function listContests(): Promise<Contest[]> {
  const profile = await getCurrentProfile().catch(() => null);
  const isManager = canManageContests(profile);
  const contestCollection = collection(db, CONTESTS);

  const contestsQuery = isManager
    ? query(contestCollection, orderBy("updated_at", "desc"))
    : query(
        contestCollection,
        where("status", "in", PUBLIC_CONTEST_STATUSES),
        orderBy("updated_at", "desc"),
      );

  const snap = await getDocs(contestsQuery);
  return snap.docs.map((d) =>
    normalizeContest({
      id: d.id,
      judge_emails: [],
      co_host_viewer_emails: [],
      metrics_snapshot: emptyMetricsSnapshot(),
      rubric_weights: defaultRubricWeights(),
      published_leaderboard: [],
      winner_announcements: [],
      ...d.data(),
    } as unknown as Contest),
  );
}

export async function getContest(contestId: string): Promise<Contest | null> {
  const ref = doc(db, CONTESTS, contestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeContest({
    id: snap.id,
    judge_emails: [],
    co_host_viewer_emails: [],
    rubric_weights: defaultRubricWeights(),
    metrics_snapshot: emptyMetricsSnapshot(),
    published_leaderboard: [],
    winner_announcements: [],
    ...snap.data(),
  } as unknown as Contest);
}

export async function createContest(data: ContestInsert): Promise<Contest> {
  const { uid } = await requireContestManager();
  const ref = doc(collection(db, CONTESTS));
  const now = new Date().toISOString();

  const payload = removeUndefinedFields({
    title: data.title.trim(),
    tagline: data.tagline.trim(),
    description: data.description?.trim() || null,
    rules: data.rules?.trim() || null,
    status: data.status ?? "draft",
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
    location: data.location ?? "hybrid",
    cover_image_url: data.cover_image_url ?? null,
    cover_image_path: data.cover_image_path ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    thumbnail_path: data.thumbnail_path ?? null,
    registration_deadline: data.registration_deadline ?? null,
    max_participants: data.max_participants ?? null,
    judge_emails: sanitizeEmailList(data.judge_emails),
    co_host_viewer_emails: sanitizeEmailList(data.co_host_viewer_emails),
    rubric_weights: data.rubric_weights ?? defaultRubricWeights(),
    metrics_snapshot: emptyMetricsSnapshot(),
    published_leaderboard: [],
    winner_announcements: [],
    prize_pool_summary: data.prize_pool_summary?.trim() || null,
    prizes: sanitizePrizeEntries(data.prizes),
    faqs: sanitizeFaqEntries(data.faqs),
    timeline_milestones: sanitizeTimelineMilestones(data.timeline_milestones ?? []),
    created_by: uid,
    updated_by: uid,
    created_at: now,
    updated_at: now,
  });

  await setDoc(ref, payload);
  return normalizeContest({ id: ref.id, ...payload } as Contest);
}

export async function updateContest(contestId: string, updates: ContestUpdate): Promise<void> {
  const { uid } = await requireContestManager();
  const ref = doc(db, CONTESTS, contestId);

  const payload = removeUndefinedFields({
    title: updates.title?.trim(),
    tagline: updates.tagline?.trim(),
    description:
      updates.description === undefined ? undefined : updates.description?.trim() || null,
    rules: updates.rules === undefined ? undefined : updates.rules?.trim() || null,
    status: updates.status,
    starts_at: updates.starts_at,
    ends_at: updates.ends_at,
    location: updates.location,
    cover_image_url: updates.cover_image_url,
    cover_image_path: updates.cover_image_path,
    thumbnail_url: updates.thumbnail_url,
    thumbnail_path: updates.thumbnail_path,
    registration_deadline: updates.registration_deadline,
    max_participants: updates.max_participants,
    judge_emails: updates.judge_emails && sanitizeEmailList(updates.judge_emails),
    co_host_viewer_emails:
      updates.co_host_viewer_emails &&
      sanitizeEmailList(updates.co_host_viewer_emails),
    rubric_weights: updates.rubric_weights,
    metrics_snapshot: updates.metrics_snapshot,
    published_leaderboard: updates.published_leaderboard,
    winner_announcements: updates.winner_announcements,
    prize_pool_summary:
      updates.prize_pool_summary === undefined
        ? undefined
        : updates.prize_pool_summary?.trim() || null,
    prizes: updates.prizes !== undefined ? sanitizePrizeEntries(updates.prizes) : undefined,
    faqs: updates.faqs !== undefined ? sanitizeFaqEntries(updates.faqs) : undefined,
    timeline_milestones:
      updates.timeline_milestones !== undefined
        ? sanitizeTimelineMilestones(updates.timeline_milestones)
        : undefined,
    updated_by: uid,
    updated_at: new Date().toISOString(),
  });

  await updateDoc(ref, payload);
}

export async function deleteContest(contestId: string): Promise<void> {
  await requireContestManager();

  const existing = await getContest(contestId);
  await deleteStorageObjectByPath(existing?.cover_image_path);
  await deleteStorageObjectByPath(existing?.thumbnail_path);

  const [registrationsSnap, invitesSnap, submissionsSnap, scoresSnap] = await Promise.all([
    getDocs(query(collection(db, CONTEST_REGISTRATIONS), where("contest_id", "==", contestId))),
    getDocs(query(collection(db, CONTEST_ACCESS_INVITES), where("contest_id", "==", contestId))),
    getDocs(query(collection(db, CONTEST_SUBMISSIONS), where("contest_id", "==", contestId))),
    getDocs(query(collection(db, CONTEST_SCORES), where("contest_id", "==", contestId))),
  ]);

  for (const registration of registrationsSnap.docs) {
    await deleteDoc(registration.ref);
  }

  for (const invite of invitesSnap.docs) {
    await deleteDoc(invite.ref);
  }

  for (const submission of submissionsSnap.docs) {
    await deleteDoc(submission.ref);
  }

  for (const score of scoresSnap.docs) {
    await deleteDoc(score.ref);
  }

  await deleteDoc(doc(db, CONTESTS, contestId));
}

export async function getMyContestRegistration(
  contestId: string,
): Promise<ContestRegistration | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const ref = doc(db, CONTEST_REGISTRATIONS, contestRegistrationId(contestId, user.uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeRegistration({ id: snap.id, ...snap.data() } as ContestRegistration);
}

export async function registerForContest(
  contestId: string,
  input: ContestRegistrationInsert,
): Promise<ContestRegistration> {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile();
  const now = new Date().toISOString();
  const registrationId = contestRegistrationId(contestId, user.uid);
  const ref = doc(db, CONTEST_REGISTRATIONS, registrationId);

  const payload = removeUndefinedFields({
    contest_id: contestId,
    user_id: user.uid,
    status: "pending" as const,
    motivation: input.motivation?.trim() || null,
    team_name: input.team_name?.trim() || null,
    team_members: sanitizeStringList(input.team_members),
    contact_email: input.contact_email?.trim() || user.email || profile?.email || null,
    contact_phone: input.contact_phone?.trim() || profile?.phone || null,
    portfolio_url: input.portfolio_url?.trim() || null,
    user_full_name:
      input.user_full_name?.trim() || profile?.full_name || user.displayName || null,
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    applied_at: now,
    updated_at: now,
  });

  await setDoc(ref, payload);
  return normalizeRegistration({ id: registrationId, ...payload } as ContestRegistration);
}

export async function getContestRegistrations(
  contestId: string,
  options?: { status?: ContestRegistrationStatus | "all" },
): Promise<ContestRegistration[]> {
  await requireContestReviewer(contestId);

  const constraints =
    options?.status && options.status !== "all"
      ? [
          where("contest_id", "==", contestId),
          where("status", "==", options.status),
          orderBy("applied_at", "desc"),
        ]
      : [where("contest_id", "==", contestId), orderBy("applied_at", "desc")];

  const snap = await getDocs(query(collection(db, CONTEST_REGISTRATIONS), ...constraints));
  return snap.docs.map((d) =>
    normalizeRegistration({ id: d.id, ...d.data() } as ContestRegistration),
  );
}

export async function reviewContestRegistration(
  contestId: string,
  userId: string,
  input: ContestRegistrationReviewInput,
): Promise<void> {
  const { uid } = await requireContestManager();
  await requireContestReviewer(contestId);
  const ref = doc(db, CONTEST_REGISTRATIONS, contestRegistrationId(contestId, userId));
  await updateDoc(ref, {
    status: input.status,
    review_note: input.review_note?.trim() || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: uid,
    updated_at: new Date().toISOString(),
  });
}

export async function getMyContestAccessInvite(
  contestId: string,
): Promise<ContestAccessInvite | null> {
  const user = auth.currentUser;
  if (!user?.email) return null;
  const ref = doc(db, CONTEST_ACCESS_INVITES, contestInviteId(contestId, user.email));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ContestAccessInvite;
}

export async function listContestAccessInvites(
  contestId: string,
): Promise<ContestAccessInvite[]> {
  await requireContestManager();
  const snap = await getDocs(
    query(
      collection(db, CONTEST_ACCESS_INVITES),
      where("contest_id", "==", contestId),
      orderBy("invited_at", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContestAccessInvite);
}

export async function createContestAccessInvite(
  contestId: string,
  input: ContestAccessInviteInsert,
): Promise<void> {
  const { uid } = await requireContestManager();
  const contest = await getContest(contestId);
  if (!contest) throw new Error("Không tìm thấy cuộc thi.");

  const email = sanitizeEmail(input.email);
  if (!email) throw new Error("Email mời không hợp lệ.");

  const roles = Array.from(new Set(input.roles));
  const ref = doc(db, CONTEST_ACCESS_INVITES, contestInviteId(contestId, email));
  const now = new Date().toISOString();

  await setDoc(
    ref,
    {
      contest_id: contestId,
      email,
      roles,
      display_name: input.display_name?.trim() || null,
      organization_name: input.organization_name?.trim() || null,
      note: input.note?.trim() || null,
      status: "pending",
      invited_by: uid,
      invited_at: now,
      responded_at: null,
    },
    { merge: true },
  );

  await updateContest(contestId, {
    judge_emails: roles.includes("judge")
      ? Array.from(new Set([...contest.judge_emails, email]))
      : contest.judge_emails.filter((item) => item !== email),
    co_host_viewer_emails: roles.includes("co_host_viewer")
      ? Array.from(new Set([...contest.co_host_viewer_emails, email]))
      : contest.co_host_viewer_emails.filter((item) => item !== email),
  });
}

export async function respondToContestAccessInvite(
  contestId: string,
  status: Extract<ContestAccessInvite["status"], "accepted" | "declined">,
): Promise<void> {
  const user = await requireCurrentUser();
  if (!user.email) throw new Error("Tài khoản của bạn chưa có email.");
  const ref = doc(db, CONTEST_ACCESS_INVITES, contestInviteId(contestId, user.email));
  await updateDoc(ref, {
    status,
    responded_at: new Date().toISOString(),
  });
}

export async function revokeContestAccessInvite(
  contestId: string,
  email: string,
): Promise<void> {
  await requireContestManager();
  const normalized = sanitizeEmail(email);
  const ref = doc(db, CONTEST_ACCESS_INVITES, contestInviteId(contestId, normalized));
  await updateDoc(ref, {
    status: "revoked",
    responded_at: new Date().toISOString(),
  });

  const contest = await getContest(contestId);
  if (!contest) return;
  await updateContest(contestId, {
    judge_emails: contest.judge_emails.filter((item) => item !== normalized),
    co_host_viewer_emails: contest.co_host_viewer_emails.filter(
      (item) => item !== normalized,
    ),
  });
}

export async function getMyContestSubmission(
  contestId: string,
): Promise<ContestSubmission | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const ref = doc(db, CONTEST_SUBMISSIONS, contestSubmissionId(contestId, user.uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ContestSubmission;
}

export async function upsertContestSubmission(
  contestId: string,
  input: ContestSubmissionInsert,
): Promise<ContestSubmission> {
  const user = await requireCurrentUser();
  const registration = await getMyContestRegistration(contestId);
  if (!registration || registration.status !== "approved") {
    throw new Error("Chỉ hồ sơ đã được duyệt mới có thể nộp bài.");
  }

  const now = new Date().toISOString();
  const submissionId = contestSubmissionId(contestId, user.uid);
  const ref = doc(db, CONTEST_SUBMISSIONS, submissionId);
  const payload = removeUndefinedFields({
    contest_id: contestId,
    user_id: user.uid,
    registration_id: registration.id,
    team_name: registration.team_name ?? null,
    team_members: registration.team_members ?? [],
    contestant_name: registration.user_full_name ?? user.displayName ?? null,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    demo_url: input.demo_url?.trim() || null,
    repo_url: input.repo_url?.trim() || null,
    slide_url: input.slide_url?.trim() || null,
    submitted_at: now,
    updated_at: now,
  });

  await setDoc(ref, payload, { merge: true });
  return { id: submissionId, ...payload } as ContestSubmission;
}

export async function listContestSubmissions(
  contestId: string,
): Promise<ContestSubmission[]> {
  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([getCurrentProfile(), getContest(contestId)]);
  if (!contest) throw new Error("Không tìm thấy cuộc thi.");

  const canSeeAll = canScoreContest(contest, profile, user.email) || canManageContests(profile);
  const baseCollection = collection(db, CONTEST_SUBMISSIONS);
  const submissionsQuery = canSeeAll
    ? query(baseCollection, where("contest_id", "==", contestId), orderBy("updated_at", "desc"))
    : query(
        baseCollection,
        where("contest_id", "==", contestId),
        where("user_id", "==", user.uid),
      );
  const snap = await getDocs(submissionsQuery);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContestSubmission);
}

export async function listContestScores(contestId: string): Promise<ContestScore[]> {
  await requireContestScorer(contestId);
  const snap = await getDocs(
    query(
      collection(db, CONTEST_SCORES),
      where("contest_id", "==", contestId),
      orderBy("updated_at", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContestScore);
}

export async function scoreContestSubmission(
  contestId: string,
  submissionId: string,
  input: ContestScoreInput,
): Promise<void> {
  const contest = await requireContestScorer(contestId);
  const user = await requireCurrentUser();
  const now = new Date().toISOString();
  const weights = contest.rubric_weights ?? defaultRubricWeights();
  const totalScore = Number(
    (
      (input.product_score / 25) * weights.product +
      (input.technical_score / 25) * weights.technical +
      (input.presentation_score / 25) * weights.presentation +
      (input.impact_score / 25) * weights.impact
    ).toFixed(2),
  );

  await setDoc(
    doc(db, CONTEST_SCORES, contestScoreId(submissionId, user.uid)),
    {
      contest_id: contestId,
      submission_id: submissionId,
      judge_uid: user.uid,
      judge_email: user.email ?? null,
      product_score: input.product_score,
      technical_score: input.technical_score,
      presentation_score: input.presentation_score,
      impact_score: input.impact_score,
      note: input.note?.trim() || null,
      total_score: totalScore,
      created_at: now,
      updated_at: now,
    },
    { merge: true },
  );
}

/** Workspace judging preview + persisted published leaderboard (includes public showcase URLs). */
export function buildContestLeaderboard(
  submissions: ContestSubmission[],
  scores: ContestScore[],
): ContestLeaderboardEntry[] {
  const scoreMap = new Map<string, ContestScore[]>();
  for (const score of scores) {
    const list = scoreMap.get(score.submission_id) ?? [];
    list.push(score);
    scoreMap.set(score.submission_id, list);
  }

  return submissions
    .map((submission) => {
      const relatedScores = scoreMap.get(submission.id) ?? [];
      const total = relatedScores.reduce((sum, score) => sum + score.total_score, 0);
      const average = relatedScores.length === 0 ? 0 : total / relatedScores.length;
      return {
        submission_id: submission.id,
        contestant_user_id: submission.user_id,
        contestant_name: submission.contestant_name,
        submission_title: submission.title,
        average_score: Number(average.toFixed(2)),
        score_count: relatedScores.length,
        rank: 0,
        team_name: submission.team_name,
        demo_url: submission.demo_url ?? null,
        repo_url: submission.repo_url ?? null,
        slide_url: submission.slide_url ?? null,
        summary: submission.summary ?? null,
      };
    })
    .sort((a, b) => {
      if (b.average_score !== a.average_score) return b.average_score - a.average_score;
      return b.score_count - a.score_count;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function refreshContestMetricsSnapshot(
  contestId: string,
): Promise<ContestMetricsSnapshot> {
  const contest = await requireContestReviewer(contestId);
  const [registrations, submissions, scores] = await Promise.all([
    getContestRegistrations(contestId, { status: "all" }),
    listContestSubmissions(contestId),
    listContestScores(contestId).catch(() => []),
  ]);

  const scoredSubmissions = new Set(scores.map((score) => score.submission_id));
  const snapshot: ContestMetricsSnapshot = {
    registrations_total: registrations.length,
    pending_registrations: registrations.filter((item) => item.status === "pending").length,
    approved_registrations: registrations.filter((item) => item.status === "approved").length,
    rejected_registrations: registrations.filter((item) => item.status === "rejected").length,
    submissions_total: submissions.length,
    scored_submissions: scoredSubmissions.size,
    published_winners: contest.winner_announcements.length,
    updated_at: new Date().toISOString(),
  };

  await updateContest(contestId, { metrics_snapshot: snapshot });
  return snapshot;
}

export async function publishContestResults(
  contestId: string,
  winnerInputs: ContestWinnerInput[],
): Promise<{
  leaderboard: ContestLeaderboardEntry[];
  winners: ContestWinner[];
}> {
  await requireContestManager();
  const [submissions, scores] = await Promise.all([
    listContestSubmissions(contestId),
    listContestScores(contestId),
  ]);
  const leaderboard = buildContestLeaderboard(submissions, scores);
  const winnerMap = new Map(leaderboard.map((entry) => [entry.submission_id, entry]));
  const winners: ContestWinner[] = winnerInputs
    .map<ContestWinner | null>((input) => {
      const entry = winnerMap.get(input.submission_id);
      if (!entry) return null;
      return {
        submission_id: input.submission_id,
        contestant_user_id: entry.contestant_user_id,
        contestant_name: entry.contestant_name,
        submission_title: entry.submission_title,
        award_title: input.award_title.trim(),
        note: input.note?.trim() || null,
        average_score: entry.average_score,
        team_name: entry.team_name,
        announced_at: new Date().toISOString(),
      };
    })
    .filter((value): value is ContestWinner => value !== null);

  await updateContest(contestId, {
    published_leaderboard: leaderboard,
    winner_announcements: winners,
    metrics_snapshot: {
      ...(await getContest(contestId))!.metrics_snapshot,
      published_winners: winners.length,
      updated_at: new Date().toISOString(),
    },
  });

  return { leaderboard, winners };
}
