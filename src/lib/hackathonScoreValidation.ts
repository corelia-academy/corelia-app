import type { ContestRubricWeights, ContestScoreInput } from "@/types/hackathons";

export const CONTEST_SCORE_MIN = 0;
export const CONTEST_SCORE_MAX = 25;
export const CONTEST_SCORE_TOTAL_MIN = 0;
export const CONTEST_SCORE_TOTAL_MAX = 100;
export const CONTEST_SCORE_OUT_OF_RANGE_ERROR = "invalid_input:score_out_of_range";
export const CONTEST_RUBRIC_WEIGHTS_INVALID_ERROR = "invalid_input:rubric_weights_invalid";

const SCORE_KEYS = [
  "product_score",
  "technical_score",
  "presentation_score",
  "impact_score",
] as const;

export function isContestScoreCriterionValid(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= CONTEST_SCORE_MIN &&
    value <= CONTEST_SCORE_MAX
  );
}

export function validateContestScoreInput(input: ContestScoreInput): void {
  if (!input || typeof input !== "object") {
    throw new Error(CONTEST_SCORE_OUT_OF_RANGE_ERROR);
  }
  const criteria = SCORE_KEYS.map((key) => input[key]);
  if (criteria.some((value) => !isContestScoreCriterionValid(value))) {
    throw new Error(CONTEST_SCORE_OUT_OF_RANGE_ERROR);
  }
}

export function validateContestRubricWeights(weights: ContestRubricWeights): void {
  const values = [
    weights.product,
    weights.technical,
    weights.presentation,
    weights.impact,
  ];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    total !== CONTEST_SCORE_TOTAL_MAX
  ) {
    throw new Error(CONTEST_RUBRIC_WEIGHTS_INVALID_ERROR);
  }
}

export function calculateContestScoreTotal(
  input: ContestScoreInput,
  weights: ContestRubricWeights,
): number {
  validateContestScoreInput(input);
  validateContestRubricWeights(weights);
  const total =
    (input.product_score / CONTEST_SCORE_MAX) * weights.product +
    (input.technical_score / CONTEST_SCORE_MAX) * weights.technical +
    (input.presentation_score / CONTEST_SCORE_MAX) * weights.presentation +
    (input.impact_score / CONTEST_SCORE_MAX) * weights.impact;
  const rounded = Number(total.toFixed(2));
  if (
    !Number.isFinite(rounded) ||
    rounded < CONTEST_SCORE_TOTAL_MIN ||
    rounded > CONTEST_SCORE_TOTAL_MAX
  ) {
    throw new Error(CONTEST_SCORE_OUT_OF_RANGE_ERROR);
  }
  return rounded;
}
