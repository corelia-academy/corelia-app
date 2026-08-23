const REQUIRED_INTENTIONAL_FIELDS = [
  "feature",
  "object",
  "migrationOrCommit",
  "owner",
  "reason",
  "expectedMainRelease",
  "reviewDate",
  "expectedCatalogDelta",
  "stagingValidationResult",
];

export function validateDriftAllowlist(allowlist, { now = new Date() } = {}) {
  const errors = [];
  const intentional = [
    ...(allowlist?.intentionalStagingFeatureDrift ?? []),
    ...(allowlist?.entries ?? []).filter((entry) => entry.kind === "EXPECTED_DRIFT"),
  ];

  for (const [index, entry] of intentional.entries()) {
    for (const field of REQUIRED_INTENTIONAL_FIELDS) {
      if (!entry?.[field]) errors.push(`Intentional drift entry ${index} is missing ${field}.`);
    }
    const reviewDate = new Date(`${entry?.reviewDate ?? ""}T00:00:00.000Z`);
    if (Number.isNaN(reviewDate.valueOf())) {
      errors.push(`Intentional drift entry ${index} has an invalid reviewDate.`);
    } else if (reviewDate < new Date(now.toISOString().slice(0, 10))) {
      errors.push(`Intentional drift entry ${index} expired on ${entry.reviewDate}; renew it with evidence or reconcile the drift.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
