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
