import { describe, expect, it } from "vitest";
import {
  GRADE_MAX,
  GRADE_MIN,
  GRADE_THRESHOLDS,
  gradeFromReactionsReceived,
} from "./grades";

describe("community grades", () => {
  it("defines ten ascending thresholds", () => {
    expect(GRADE_THRESHOLDS).toHaveLength(10);
    expect(GRADE_THRESHOLDS[0]).toBe(0);
    for (let i = 1; i < GRADE_THRESHOLDS.length; i++) {
      expect(GRADE_THRESHOLDS[i]!).toBeGreaterThan(GRADE_THRESHOLDS[i - 1]!);
    }
    expect(GRADE_MIN).toBe(1);
    expect(GRADE_MAX).toBe(10);
  });

  it("maps reaction counts to grades 1–10", () => {
    expect(gradeFromReactionsReceived(0)).toBe(1);
    expect(gradeFromReactionsReceived(9)).toBe(1);
    expect(gradeFromReactionsReceived(10)).toBe(2);
    expect(gradeFromReactionsReceived(24)).toBe(2);
    expect(gradeFromReactionsReceived(25)).toBe(3);
    expect(gradeFromReactionsReceived(49)).toBe(3);
    expect(gradeFromReactionsReceived(50)).toBe(4);
    expect(gradeFromReactionsReceived(99)).toBe(4);
    expect(gradeFromReactionsReceived(100)).toBe(5);
    expect(gradeFromReactionsReceived(174)).toBe(5);
    expect(gradeFromReactionsReceived(175)).toBe(6);
    expect(gradeFromReactionsReceived(274)).toBe(6);
    expect(gradeFromReactionsReceived(275)).toBe(7);
    expect(gradeFromReactionsReceived(399)).toBe(7);
    expect(gradeFromReactionsReceived(400)).toBe(8);
    expect(gradeFromReactionsReceived(549)).toBe(8);
    expect(gradeFromReactionsReceived(550)).toBe(9);
    expect(gradeFromReactionsReceived(749)).toBe(9);
    expect(gradeFromReactionsReceived(750)).toBe(10);
    expect(gradeFromReactionsReceived(10_000)).toBe(10);
  });

  it("clamps invalid inputs to grade 1", () => {
    expect(gradeFromReactionsReceived(-3)).toBe(1);
    expect(gradeFromReactionsReceived(Number.NaN)).toBe(1);
  });
});
