import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { careerCatalogQueryOptions } from "@/features/career/careerQueries";

export function useCareerTracksCatalog() {
  const { t, i18n } = useTranslation("career");
  const query = useQuery(careerCatalogQueryOptions(i18n.language));
  const tracks = query.data ?? [];
  return {
    tracks,
    hasTracks: tracks.length > 0,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? t("errors.loadFailed") : null,
  };
}
