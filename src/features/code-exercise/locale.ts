import type { CodeExerciseLocaleContent, CodeExercisePartLocale } from "./types";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Recover display copy only; never touch machine config, IDs, or the source object. */
export function normalizeCodeLocale(input: unknown): { value: CodeExerciseLocaleContent; invalid: boolean } {
  if (input === undefined) return { value: {}, invalid: false };
  if (!record(input)) return { value: {}, invalid: true };
  const value: CodeExerciseLocaleContent = {};
  let invalid = false;
  if (input.instructions !== undefined) {
    if (typeof input.instructions === "string") value.instructions = input.instructions;
    else invalid = true;
  }
  if (input.hints !== undefined) {
    if (Array.isArray(input.hints)) {
      value.hints = input.hints.filter((hint): hint is string => typeof hint === "string");
      invalid ||= value.hints.length !== input.hints.length;
    } else invalid = true;
  }
  if (input.blank_feedback !== undefined) {
    if (record(input.blank_feedback)) {
      value.blank_feedback = Object.fromEntries(Object.entries(input.blank_feedback).filter(([, text]) => {
        if (typeof text === "string") return true;
        invalid = true; return false;
      })) as Record<string, string>;
    } else invalid = true;
  }
  if (input.test_copy !== undefined) {
    if (record(input.test_copy)) {
      value.test_copy = {};
      for (const [id, copy] of Object.entries(input.test_copy)) {
        if (!record(copy)) { invalid = true; continue; }
        const entry: NonNullable<CodeExerciseLocaleContent["test_copy"]>[string] = {};
        for (const field of ["description", "failure_message", "hint"] as const) {
          if (copy[field] === undefined) continue;
          if (typeof copy[field] === "string") entry[field] = copy[field];
          else invalid = true;
        }
        Object.defineProperty(value.test_copy, id, { value: entry, enumerable: true, configurable: true, writable: true });
      }
    } else invalid = true;
  }
  if (input.parts !== undefined) {
    if (Array.isArray(input.parts) && input.parts.length === 2) {
      const partsNormalized: [CodeExercisePartLocale, CodeExercisePartLocale] = [{}, {}];
      for (let i = 0; i < 2; i++) {
        const p = input.parts[i];
        if (!record(p)) { invalid = true; continue; }
        const pNorm: CodeExercisePartLocale = {};
        if (p.instructions !== undefined) {
          if (typeof p.instructions === "string") pNorm.instructions = p.instructions;
          else invalid = true;
        }
        if (p.hints !== undefined) {
          if (Array.isArray(p.hints)) {
            pNorm.hints = p.hints.filter((hint): hint is string => typeof hint === "string");
            invalid ||= pNorm.hints.length !== p.hints.length;
          } else invalid = true;
        }
        if (p.blank_feedback !== undefined) {
          if (record(p.blank_feedback)) {
            pNorm.blank_feedback = Object.fromEntries(Object.entries(p.blank_feedback).filter(([, text]) => {
              if (typeof text === "string") return true;
              invalid = true; return false;
            })) as Record<string, string>;
          } else invalid = true;
        }
        if (p.test_copy !== undefined) {
          if (record(p.test_copy)) {
            pNorm.test_copy = {};
            for (const [id, copy] of Object.entries(p.test_copy)) {
              if (!record(copy)) { invalid = true; continue; }
              const entry: NonNullable<CodeExercisePartLocale["test_copy"]>[string] = {};
              for (const field of ["description", "failure_message", "hint"] as const) {
                if (copy[field] === undefined) continue;
                if (typeof copy[field] === "string") entry[field] = copy[field];
                else invalid = true;
              }
              Object.defineProperty(pNorm.test_copy, id, { value: entry, enumerable: true, configurable: true, writable: true });
            }
          } else invalid = true;
        }
        partsNormalized[i] = pNorm;
      }
      value.parts = partsNormalized;
    } else {
      invalid = true;
    }
  }
  return { value, invalid };
}
