/** Closed issue taxonomy shared by the curriculum and lesson reviewers. */
export const REVIEW_ISSUE_CATEGORIES = [
  "factual_inaccuracy",
  "wrong_source",
  "wrong_answer",
  "missing_safety_warning",
  "outcome_mismatch",
  "optional_made_mandatory",
  "unsupported_platform_format",
  "missing_practice",
  "missing_installation_steps",
  "insufficient_description",
  "style_or_wording",
  "other",
] as const;

export type ReviewIssueCategory = typeof REVIEW_ISSUE_CATEGORIES[number];

export const BLOCKING_REVIEW_CATEGORIES = [
  "factual_inaccuracy",
  "wrong_source",
  "wrong_answer",
  "missing_safety_warning",
  "outcome_mismatch",
  "optional_made_mandatory",
  "unsupported_platform_format",
] as const satisfies readonly ReviewIssueCategory[];

export const A4_REVIEW_CRITERIA = [
  "outcome_activity_assessment_alignment",
  "prerequisites",
  "practice_and_feedback",
  "review_and_application",
  "sources_by_topic",
  "no_submissions",
  "supported_platform_formats",
  "outcome_coverage",
] as const;

export const A6_REVIEW_CRITERIA = [
  "factual_accuracy_by_sources",
  "tool_versions",
  "outcome_and_level_fit",
  "lesson_sequence",
  "quiz_answers",
  "diagrams",
  "no_submissions",
] as const;

export interface EffectiveReviewIssue extends Record<string, unknown> {
  location?: string;
  problem?: string;
  severity: "blocking" | "minor";
  category: ReviewIssueCategory;
}

export interface NormalizedReviewIssues {
  issues: EffectiveReviewIssue[];
  downgraded: EffectiveReviewIssue[];
}

export type ReviewCheckResult = "ok" | "issue" | "unverified";
export type ReviewVerificationMethod = "tool" | "source" | "reasoning";

export interface NormalizedReviewCheck {
  criterion: string;
  result: ReviewCheckResult;
  basis: string;
  refs: string[];
  verified_by?: ReviewVerificationMethod;
}

/**
 * Reconcile model/legacy severity with the closed policy. Missing or unknown categories are
 * treated as `other`, so old saved reviews remain readable without preserving an unqualified block.
 */
export function normalizeReviewIssues(input: unknown): NormalizedReviewIssues {
  const categories = new Set<string>(REVIEW_ISSUE_CATEGORIES);
  const blockingCategories = new Set<string>(BLOCKING_REVIEW_CATEGORIES);
  const downgraded: EffectiveReviewIssue[] = [];
  const issues = (Array.isArray(input) ? input : []).flatMap((raw): EffectiveReviewIssue[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const issue = raw as Record<string, unknown>;
    const category = typeof issue.category === "string" && categories.has(issue.category)
      ? issue.category as ReviewIssueCategory
      : "other";
    const severity = issue.severity === "blocking" && blockingCategories.has(category) ? "blocking" : "minor";
    const effective = {
      ...issue,
      category,
      severity,
    } as EffectiveReviewIssue;
    if (issue.severity === "blocking" && severity === "minor") downgraded.push(effective);
    return [effective];
  });
  return { issues, downgraded };
}

/**
 * Keep reviewer check evidence readable even when the model omits or misstates part of it.
 * The closed criterion list is owned by each reviewer; verdicts continue to come from issues.
 */
export function normalizeReviewChecks(
  input: unknown,
  criteria: readonly string[],
  issues: readonly { criterion?: unknown; severity?: unknown }[],
  resolvesRef: (ref: string) => boolean,
  includeVerificationMethod = false,
): NormalizedReviewCheck[] {
  const allowed = new Set(criteria);
  const checksByCriterion = new Map<string, NormalizedReviewCheck>();
  const rawChecks = Array.isArray(input) ? input : [];

  for (const raw of rawChecks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const check = raw as Record<string, unknown>;
    if (typeof check.criterion !== "string" || !allowed.has(check.criterion) || checksByCriterion.has(check.criterion)) continue;

    const criterion = check.criterion;
    const refsInput = Array.isArray(check.refs) ? check.refs : [];
    let invalidRef = !Array.isArray(check.refs);
    const refs = refsInput.flatMap((ref): string[] => {
      if (typeof ref !== "string" || !resolvesRef(ref)) {
        invalidRef = true;
        return [];
      }
      return [ref];
    });
    const basisInput = typeof check.basis === "string" ? check.basis.trim() : "";
    const basis = basisInput ? basisInput.slice(0, 160) : "không được báo cáo";
    const hasEvidence = basisInput.length > 0 && refs.length > 0 && !invalidRef;
    let result: ReviewCheckResult = check.result === "ok" || check.result === "issue" || check.result === "unverified"
      ? check.result
      : "unverified";

    if ((result === "ok" || result === "issue") && !hasEvidence) result = "unverified";
    const matchingIssues = issues.filter((issue) => issue.criterion === criterion);
    if (result === "ok" && matchingIssues.some((issue) => issue.severity === "blocking")) result = "issue";
    if (result === "issue" && matchingIssues.length === 0) result = "unverified";

    const normalized: NormalizedReviewCheck = { criterion, result, basis, refs };
    if (includeVerificationMethod) {
      if (check.verified_by === "tool" || check.verified_by === "source" || check.verified_by === "reasoning") {
        normalized.verified_by = check.verified_by;
      } else if (result !== "unverified") {
        normalized.result = "unverified";
      }
    }
    checksByCriterion.set(criterion, normalized);
  }

  return criteria.map((criterion) => checksByCriterion.get(criterion) ?? {
    criterion,
    result: "unverified",
    basis: "không được báo cáo",
    refs: [],
  });
}
