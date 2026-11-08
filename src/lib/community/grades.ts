/** Community rank derived from total reactions received on a user's posts and comments. */

export const GRADE_MIN = 1;
export const GRADE_MAX = 10;

/**
 * Inclusive lower bounds for grades 1–10.
 * Grade N applies when reactionsReceived >= GRADE_THRESHOLDS[N - 1]
 * and (N === 10 or reactionsReceived < GRADE_THRESHOLDS[N]).
 *
 * | Grade | Reactions received |
 * | ----- | ------------------ |
 * | 1     | 0–9                |
 * | 2     | 10–24              |
 * | 3     | 25–49              |
 * | 4     | 50–99              |
 * | 5     | 100–174            |
 * | 6     | 175–274            |
 * | 7     | 275–399            |
 * | 8     | 400–549            |
 * | 9     | 550–749            |
 * | 10    | 750+               |
 */
export const GRADE_THRESHOLDS: readonly number[] = [
  0, 10, 25, 50, 100, 175, 275, 400, 550, 750,
] as const;

export type CommunityGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function gradeFromReactionsReceived(count: number): CommunityGrade {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  let grade: CommunityGrade = 1;
  for (let i = GRADE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (n >= GRADE_THRESHOLDS[i]!) {
      grade = (i + 1) as CommunityGrade;
      break;
    }
  }
  return grade;
}

/** Short label key suffix for i18n: community.grade.1 … community.grade.10 */
export function gradeLabelKey(grade: CommunityGrade): `community.grade.${CommunityGrade}` {
  return `community.grade.${grade}`;
}
