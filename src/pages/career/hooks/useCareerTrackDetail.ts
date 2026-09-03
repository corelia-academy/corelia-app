import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { careerDetailQueryOptions } from "@/features/career/careerQueries";

export function useCareerTrackDetail(slug: string | undefined) {
  const { t, i18n } = useTranslation("career");
  const query = useQuery(careerDetailQueryOptions(slug, i18n.language));
  return {
    track: query.data ?? null,
    loading: Boolean(slug) && query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? t("errors.loadFailed") : null,
  };
}
