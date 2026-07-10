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

/** Extract the on-chain credential id from an OC `/issuer/vc` response.
 *
 *  The OC API wraps the verifiable credential in a `vc` object and identifies it
 *  by `vc.id` = "urn:uuid:<uuid>". The public credential URL, however, uses the
 *  NUMERIC token id (the UUID as a uint256). We therefore unwrap `vc`, read the
 *  UUID, and convert it to the numeric token id so it matches the public URL.
 *
 *  A few direct numeric fields (tokenId/credentialId) are also checked first to
 *  stay forward-compatible if OC changes the response shape. */
function truthyString(value: unknown): string | null {
  return value ? String(value) : null;
}

export function extractOcCredentialId(response: unknown): string | null {
  if (response == null || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const vc = (root.vc && typeof root.vc === "object" ? root.vc : root) as Record<string, unknown>;

  // Forward-compatible: a direct numeric token id, if OC ever returns one.
  const direct: string | null =
    truthyString(vc.tokenId) ??
    truthyString(vc.credentialId) ??
    truthyString(root.tokenId) ??
    truthyString(root.credentialId);
  if (direct && /^\d+$/.test(direct.trim())) return direct.trim();

  // The credential id is a urn:uuid — convert to the numeric NFT token id.
  const rawId: string = truthyString(vc.id) ?? truthyString(root.id) ?? direct ?? "";
  if (rawId.trim()) {
    return uuidToTokenId(rawId.trim()) ?? rawId.trim();
  }
  return null;
}
