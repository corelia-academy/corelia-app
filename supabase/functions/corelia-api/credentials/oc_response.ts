/** Convert an OC credential UUID (urn:uuid:... or bare UUID) into the numeric
 *  NFT token id that the OC public credential URL uses as `?id=...`.
 *  The token id is the 128-bit UUID interpreted as a uint256 decimal. */
export function uuidToTokenId(value: string): string | null {
  const hex = value.replace(/^urn:uuid:/i, "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  try {
    return BigInt("0x" + hex).toString();
  } catch {
    return null;
  }
}

function extractOcCredentialIdFromText(text: string): string | null {
  const numeric = text.match(/\b(?:credentialId|credential_id|tokenId|token_id)\s*[:=]\s*(\d+)\b/i)?.[1];
  if (numeric) return numeric;

  const urn = text.match(/\burn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
  if (urn) return uuidToTokenId(urn) ?? urn;

  return null;
}

function collectNestedStrings(value: unknown, out: string[], seen: WeakSet<object>): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (value == null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectNestedStrings(item, out, seen);
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectNestedStrings(item, out, seen);
  }
}

/** Extract the on-chain credential id from an OC `/issuer/vc` response.
 *
 *  The OC API wraps the verifiable credential in a `vc` object and identifies it
 *  by `vc.id` = "urn:uuid:<uuid>". The public credential URL, however, uses the
 *  NUMERIC token id (the UUID as a uint256). We therefore unwrap `vc`, read the
 *  UUID, and convert it to the numeric token id so it matches the public URL.
 *
 *  A few direct numeric fields (tokenId/credentialId) are also checked first to
 *  stay forward-compatible if OC changes the response shape. */
export function extractOcCredentialId(response: unknown): string | null {
  if (typeof response === "string") return extractOcCredentialIdFromText(response);
  if (response == null || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const vc = (root.vc && typeof root.vc === "object" ? root.vc : root) as Record<string, unknown>;

  // Forward-compatible: a direct numeric token id, if OC ever returns one.
  const direct =
    (vc.tokenId && String(vc.tokenId)) ||
    (vc.token_id && String(vc.token_id)) ||
    (vc.credentialId && String(vc.credentialId)) ||
    (vc.credential_id && String(vc.credential_id)) ||
    (root.tokenId && String(root.tokenId)) ||
    (root.token_id && String(root.token_id)) ||
    (root.credentialId && String(root.credentialId)) ||
    (root.credential_id && String(root.credential_id)) ||
    null;
  if (direct && /^\d+$/.test(direct.trim())) return direct.trim();

  // The credential id is a urn:uuid — convert to the numeric NFT token id.
  const rawId = (vc.id && String(vc.id)) || (root.id && String(root.id)) || (direct ?? "");
  if (rawId.trim()) {
    return uuidToTokenId(rawId.trim()) ?? rawId.trim();
  }

  const nestedStrings: string[] = [];
  collectNestedStrings(root, nestedStrings, new WeakSet<object>());
  for (const candidate of nestedStrings) {
    const extracted = extractOcCredentialIdFromText(candidate);
    if (extracted) return extracted;
  }

  return null;
}
