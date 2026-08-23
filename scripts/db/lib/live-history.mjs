export function compareLiveHistory({ baseline, capture, allowlist, environment, expectedProjectRef }) {
  const errors = [];
  const warnings = [];
  const expected = baseline?.liveMigrationHistory?.[environment];
  if (!expected) return { ok: false, errors: [`No ${environment} live history exists in the frozen baseline.`], warnings };
  if (capture?.projectRef !== expectedProjectRef) {
    errors.push(`Refusing history comparison: expected project ref ${expectedProjectRef}, got ${capture?.projectRef ?? "missing"}.`);
  }
  const actualCount = capture?.migrations?.length;
  const actualLatest = capture?.migrations?.at(-1)?.version;
  const mismatch = actualCount !== expected.appliedMigrationCount || actualLatest !== expected.latestMigration;
  if (mismatch) {
    const allowed = (allowlist?.entries ?? []).some((entry) => entry.kind === "EXPECTED_HISTORICAL_DRIFT" && entry.surface === "migration_history" && entry.environments?.includes(environment));
    const message = `${environment} history differs from baseline: expected ${expected.appliedMigrationCount}/${expected.latestMigration}, got ${actualCount}/${actualLatest ?? "none"}.`;
    if (allowed) warnings.push(`${message} Allowlisted historical drift requires review.`);
    else errors.push(`${message} This is unexpected drift; block release until it is investigated.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
