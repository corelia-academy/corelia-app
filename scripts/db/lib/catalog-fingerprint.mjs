import { createHash } from "node:crypto";

export const FINGERPRINT_CATEGORIES = [
  "tables",
  "columns",
  "primaryKeys",
  "foreignKeys",
  "uniqueConstraints",
  "checkConstraints",
  "rlsPolicies",
  "functions",
  "triggers",
  "indexes",
];

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function normalizeSqlDefinition(value) {
  if (typeof value !== "string") return value;
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function semanticValue(value, key = "") {
  if (Array.isArray(value)) return value.map((entry) => semanticValue(entry, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, semanticValue(childValue, childKey)]));
  }
  return /(definition|using|withcheck|with_check|expression|body|predicate|condition|sql)$/i.test(key)
    ? normalizeSqlDefinition(value)
    : value;
}

export function fingerprintCatalog(capture) {
  const categories = {};
  for (const category of FINGERPRINT_CATEGORIES) {
    const raw = stable(capture?.objects?.[category] ?? []);
    const semantic = stable(semanticValue(capture?.objects?.[category] ?? []));
    categories[category] = {
      count: Array.isArray(raw) ? raw.length : 0,
      rawSha256: hash(JSON.stringify(raw)),
      semanticSha256: hash(JSON.stringify(semantic)),
    };
  }

  return {
    schemaVersion: 1,
    source: stable(capture?.source ?? {}),
    categories,
    rawSha256: hash(JSON.stringify(Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, value.rawSha256])))),
    semanticSha256: hash(JSON.stringify(Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, value.semanticSha256])))),
    limitations: [
      "Only CRLF/CR and trailing-whitespace normalization is applied to SQL-like fields.",
      "Predicate ordering and SQL syntax are intentionally not rewritten; review semantic mismatches before allowlisting them.",
      "Indexes are fingerprinted separately but must not block Wave 0 parity decisions.",
    ],
  };
}
