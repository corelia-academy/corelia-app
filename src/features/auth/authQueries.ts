import { queryOptions } from "@tanstack/react-query";

import { getAuthenticatorAssuranceLevel, listMfaFactors } from "@/lib/auth";

export const authQueryKeys = {
  all: ["auth"] as const,
  assurance: (userId: string) => [...authQueryKeys.all, "assurance", userId] as const,
  factors: (userId: string) => [...authQueryKeys.all, "factors", userId] as const,
};

export function mfaAssuranceQueryOptions(userId: string | undefined, enabled: boolean) {
  return queryOptions({
    queryKey: authQueryKeys.assurance(userId ?? "missing"),
    queryFn: getAuthenticatorAssuranceLevel,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
    meta: {
      scope: "private",
      userId: userId ?? "missing",
      showInGlobalLoading: false,
    },
  });
}

export function mfaFactorsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: authQueryKeys.factors(userId ?? "missing"),
    queryFn: listMfaFactors,
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: false,
    meta: {
      scope: "private",
      userId: userId ?? "missing",
      showInGlobalLoading: false,
    },
  });
}
