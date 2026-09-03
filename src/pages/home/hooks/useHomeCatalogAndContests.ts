import { useQuery } from "@tanstack/react-query";
import i18n from "@/i18n";
import { useAuth } from "@/stores/authStore";
import { homeCatalogQueryOptions } from "../queries/homeQueries";

export function useHomeCatalogAndContests() {
  const { user } = useAuth();
  const query = useQuery(homeCatalogQueryOptions(user, i18n.language));
  return {
    courseCatalog: query.data?.courseCatalog ?? [],
    contests: query.data?.contests ?? [],
    loading: query.isPending,
    error: query.error,
  };
}
