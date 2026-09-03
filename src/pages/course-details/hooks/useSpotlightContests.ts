import { useQuery } from "@tanstack/react-query";

import { spotlightContestsQueryOptions } from "@/features/courses/courseQueries";
import i18n from "@/i18n";
import { useAuth } from "@/stores/authStore";

export function useSpotlightContests() {
  const { user } = useAuth();
  const query = useQuery(spotlightContestsQueryOptions(user, i18n.language));

  return query.data ?? [];
}
