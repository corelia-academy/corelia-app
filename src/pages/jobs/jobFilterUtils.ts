/**
 * Safely parses salary filter value from query param or user input.
 * Preserves 0 as a valid filter value, while discarding NaN, negative numbers, and empty strings.
 */
export function parseSalaryFilter(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return num;
}
