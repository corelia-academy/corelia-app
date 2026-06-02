import { describe, expect, it } from "vitest";

import {
  calculateContestScoreTotal,
  isContestScoreCriterionValid,
  validateContestScoreInput,
  validateContestRubricWeights,
} from "./hackathonScoreValidation";

describe("hackathonScoreValidation", () => {
  it("accepts finite score criteria within 0..25", () => {
    expect(isContestScoreCriterionValid(0)).toBe(true);
    expect(isContestScoreCriterionValid(12.5)).toBe(true);
    expect(isContestScoreCriterionValid(25)).toBe(true);

    expect(() =>
      validateContestScoreInput({
        product_score: 25,
        technical_score: 20,
        presentation_score: 10,
        impact_score: 0,
      }),
    ).not.toThrow();
  });

  it("rejects out-of-range score criteria", () => {
    expect(isContestScoreCriterionValid(-1)).toBe(false);
    expect(isContestScoreCriterionValid(26)).toBe(false);

    expect(() =>
      validateContestScoreInput({
        product_score: 999,
        technical_score: 0,
        presentation_score: 0,
        impact_score: 0,
      }),
    ).toThrowError("invalid_input:score_out_of_range");
  });

  it("rejects non-finite score criteria", () => {
    expect(isContestScoreCriterionValid(Number.NaN)).toBe(false);
    expect(isContestScoreCriterionValid(Number.POSITIVE_INFINITY)).toBe(false);

    expect(() =>
      validateContestScoreInput({
        product_score: Number.NaN,
        technical_score: 0,
        presentation_score: 0,
        impact_score: 0,
      }),
    ).toThrowError("invalid_input:score_out_of_range");
  });

  it("rejects non-number score criteria at runtime", () => {
    expect(() =>
      validateContestScoreInput({
        product_score: "25",
        technical_score: 0,
        presentation_score: 0,
        impact_score: 0,
      } as unknown as Parameters<typeof validateContestScoreInput>[0]),
    ).toThrowError("invalid_input:score_out_of_range");
  });

  it("calculates the canonical weighted total score", () => {
    expect(
      calculateContestScoreTotal(
        {
          product_score: 25,
          technical_score: 12.5,
          presentation_score: 0,
          impact_score: 25,
        },
        {
          product: 40,
          technical: 30,
          presentation: 20,
          impact: 10,
        },
      ),
    ).toBe(65);
  });

  it("rejects invalid rubric weights before scoring", () => {
    expect(() =>
      validateContestRubricWeights({
        product: 40,
        technical: 30,
        presentation: 20,
        impact: 20,
      }),
    ).toThrowError("invalid_input:rubric_weights_invalid");
  });
});
