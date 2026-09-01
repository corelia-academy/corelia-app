import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { publicHackathonDetailQueryOptions } from "@/features/hackathons/hackathonQueries";
import type { Contest } from "@/types/hackathons";
import { useTranslation } from "react-i18next";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";

const PUBLIC_STATUSES: Contest["status"][] = ["published", "running", "ended"];

export default function ContestPublicLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation("contests");
  const queryClient = useQueryClient();
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const options = publicHackathonDetailQueryOptions(slug, locale);
  const query = useQuery(options);
  const loadedContest = query.data;
  const contest =
    loadedContest &&
    loadedContest.slug === slug &&
    PUBLIC_STATUSES.includes(loadedContest.status)
      ? loadedContest
      : null;
  const setContest = useCallback(
    (next: Contest) => queryClient.setQueryData(options.queryKey, next),
    [options.queryKey, queryClient],
  );

  if (query.isPending) {
    return <ContestDetailLoadingCard translate={translate} />;
  }

  if (query.error || !contest || !slug) {
    return (
      <PageContainer width="default">
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16 text-center"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-medium text-foreground">
            {query.error
              ? translate("detail.errors.loadFailed")
              : translate("detail.errors.notFound")}
          </p>
          <Button
            render={<NavLink to="/hackathons" />}
            nativeButton={false}
            variant="outline"
            className="min-h-11"
          >
            {translate("detail.errorState.backToList")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return <Outlet context={{ contest, setContest }} />;
}
