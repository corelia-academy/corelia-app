/**
 * Align with Supabase Dashboard → Auth → Password:
 * minimum length and character classes (lowercase, uppercase, digit, symbol).
 * If Dashboard policy changes, update this module and matching i18n copy.
 */

export const PASSWORD_MIN_LENGTH = 8;

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
/** Non-alphanumeric symbols (typical "special character" for password rules). */
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export type PasswordPolicyFailureReason = "too_short" | "missing_classes";

/**
 * Returns whether the password satisfies the project policy (mirrors strong
 * Supabase preset: length + lower, upper, digit, symbol).
 */
export function passwordMeetsProjectPolicy(password: string): boolean {
  return passwordPolicyFailureReason(password) === null;
}

/**
 * `null` if valid; otherwise why client-side validation failed.
 */
export function passwordPolicyFailureReason(
  password: string,
): PasswordPolicyFailureReason | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (
    !HAS_LOWER.test(password) ||
    !HAS_UPPER.test(password) ||
    !HAS_DIGIT.test(password) ||
    !HAS_SYMBOL.test(password)
  ) {
    return "missing_classes";
  }
  return null;
}
