/** Deterministic OpenCampus IDs.
 *
 * OC requires issuerReferenceId to be unique for every credential issued by an
 * issuer. The historical `${identifierPrefix}:${userId}` format collided when
 * two templates reused a prefix for the same learner. V2 includes both stable
 * UUIDs, while remaining compact enough for OC's public identifier fields.
 */
function idFragment(value: string): string {
  return value.replace(/-/g, "").toLowerCase().slice(0, 16);
}

/** V1 reference retained only to find already-stored legacy issuances. */
export function legacyIssuerReferenceId(identifierPrefix: string, userId: string): string {
  return `${identifierPrefix.trim()}:${userId.replace(/-/g, "")}`;
}

export function issuerReferenceId(templateId: string, userId: string): string {
  return `ocv2:${idFragment(templateId)}:${idFragment(userId)}`;
}

/** Public VC identifier: readable program prefix plus a stable 96-bit digest.
 * OC limits this field to 50 characters. The digest includes both UUIDs so
 * templates and learners stay distinct even when their prefixes match.
 * issuerReferenceId remains unchanged for issuance/idempotency lookups.
 */
export async function achievementIdentifier(
  identifierPrefix: string,
  templateId: string,
  userId: string,
): Promise<string> {
  const prefix = identifierPrefix.trim().toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .slice(0, 25)
    .replace(/[-:]+$/, "") || "corelia";
  const input = new TextEncoder().encode(`${templateId.toLowerCase()}:${userId.toLowerCase()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const suffix = Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}:${suffix}`;
}
