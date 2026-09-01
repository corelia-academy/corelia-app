import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { homeDashboardQueryOptions } from "../queries/homeQueries";

export function useHomeUserDashboard(user: User | null, t: TFunction<"common">) {
  const query = useQuery(homeDashboardQueryOptions(user, i18n.language, t));
  return {
    loading: user != null && query.isPending,
    focusCards: query.data?.focusCards ?? [],
    issuedCertificates: query.data?.issuedCertificates ?? 0,
    error: query.error,
  };
}
