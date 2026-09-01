import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { publicProfileLayoutQueryOptions } from "@/features/profiles/publicProfileQueries";

export function useUserProfileLayoutData(handle: string | undefined) {
  const { t } = useTranslation("common");
  const query = useQuery(publicProfileLayoutQueryOptions(handle));
  const notFound = !query.isPending && !query.error && !query.data?.profile;

  return {
    profile: query.data?.profile ?? null,
    followingProfileCount: query.data?.followingProfileCount ?? 0,
    loading: Boolean(handle) && query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : t("userProfile.errors.loadFailed")
      : notFound
        ? t("userProfile.errors.notFound")
        : null,
  };
}
