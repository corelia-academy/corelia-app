import { queryOptions } from "@tanstack/react-query";

import { invokeVerifyCertificate } from "@/lib/certificatesEdge";
import { invokeClaimLookup } from "@/lib/credentialsEdge";

export const credentialKeys = {
  all: ["credentials"] as const,
  claim: (email: string) => [...credentialKeys.all, "claim", email] as const,
  verify: (code: string) => [...credentialKeys.all, "verify", code] as const,
};

export function pendingCredentialClaimQueryOptions(email: string) {
  const normalized = email.trim().toLowerCase();
  return queryOptions({
    queryKey: credentialKeys.claim(normalized || "missing"),
    queryFn: () => invokeClaimLookup(normalized),
    enabled: normalized.length > 0,
    staleTime: 60_000,
    retry: false,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function verifyCertificateQueryOptions(code: string) {
  const normalized = code.trim();
  return queryOptions({
    queryKey: credentialKeys.verify(normalized || "missing"),
    queryFn: () => invokeVerifyCertificate(normalized),
    enabled: normalized.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}
