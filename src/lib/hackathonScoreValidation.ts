import type { ContestScoreInput } from "@/types/hackathons";

export const CONTEST_SCORE_MIN = 0;
export const CONTEST_SCORE_MAX = 25;

export function isContestScoreCriterionValid(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= CONTEST_SCORE_MIN &&
    value <= CONTEST_SCORE_MAX
  );
}

export function validateContestScoreInput(input: ContestScoreInput): void {
  const criteria = [
    input.product_score,
    input.technical_score,
    input.presentation_score,
    input.impact_score,
  ];
  if (criteria.some((value) => !isContestScoreCriterionValid(value))) {
    throw new Error("invalid_input:score_out_of_range");
  }
}
