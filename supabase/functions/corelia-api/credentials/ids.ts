/** Deterministic IDs for OpenCampus (issuer_reference_id + VC achievement.identifier ≤ 50 chars). */

export function issuerReferenceId(identifierPrefix: string, userId: string): string {
  const p = identifierPrefix.trim();
  const compact = userId.replace(/-/g, "");
  return `${p}:${compact}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Achievement identifier in VC payload (max 50 chars per Corelia spec). */
export async function achievementIdentifier(identifierPrefix: string, userId: string): Promise<string> {
  const p = identifierPrefix.trim();
  const compact = userId.replace(/-/g, "");
  const full = `${p}:${compact}`;
  if (full.length <= 50) return full;
  const h = (await sha256Hex(`${p}:${userId}`)).slice(0, 14);
  const shortened = `${p}:${h}`;
  return shortened.length <= 50 ? shortened : shortened.slice(0, 50);
}
