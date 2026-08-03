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

/** Achievement identifier in VC payload (max 50 chars per Corelia spec). */
export async function achievementIdentifier(
  identifierPrefix: string,
  templateId: string,
  userId: string,
): Promise<string> {
  const prefix = identifierPrefix.trim().slice(0, 14);
  return `${prefix}:v2:${idFragment(templateId)}:${idFragment(userId)}`.slice(0, 50);
}
