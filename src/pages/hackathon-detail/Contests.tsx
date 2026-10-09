import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { FullPageEmptyState } from "@/components/layouts/FullPageEmptyState";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Timestamp } from "@/components/ui/timestamp";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import type { PublicHackathonApplicant } from "@/lib/hackathonApplicants";
import { canRegisterForContest, getEffectiveContestSubmissionDeadline } from "@/lib/hackathons";
import type { Contest } from "@/types/hackathons";
import { formatPrizeAmount } from "./utils/formatPrizeAmount";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { publicHackathonApplicantPreviewsQueryOptions, publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import {
  contestListLocationLabel,
} from "@/features/hackathons/list/contestListFormatters";

const EMPTY_CONTESTS: Contest[] = [];

function CatalogGridSkeleton() {
  return <>{Array.from({ length: 3 }).map((_, index) => (
    <div key={index} className="grid min-h-[202px] overflow-hidden rounded-xl border border-border xl:h-[202px] xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_352px] xl:gap-x-10">
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <div className="border-t border-border-subtle pt-4"><Skeleton className="h-6 w-40" /></div>
      </div>
      <Skeleton className="aspect-[44/25] w-full rounded-none xl:aspect-auto xl:self-stretch" />
    </div>
  ))}</>;
}

export default function Contests() {
  const { t, i18n } = useTranslation("contests");
  const { t: commonT } = useTranslation("common");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const catalogQuery = useQuery(publicHackathonCatalogQueryOptions(locale));
  const items: Contest[] = catalogQuery.data ?? EMPTY_CONTESTS;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const applicantsQuery = useQuery(publicHackathonApplicantPreviewsQueryOptions(items.map((item) => item.id)));
  const loading = catalogQuery.isPending;
  const error = catalogQuery.error
    ? catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : translate("catalog.loadErrorFallback")
    : null;

  const showData = !loading && !error;
  const showEmpty = showData && items.length === 0 && !search.trim();
  const showGrid = showData && items.length > 0;
  const showError = !loading && Boolean(error);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);

    return items
      .filter((contest) => {
        const searchableText = [
          contest.title,
          contest.host?.name ?? "",
          contest.short_description ?? contest.tagline ?? "",
        ];

        return searchableText.some((value) =>
          value.toLocaleLowerCase(locale).includes(query),
        );
      })
      .sort((a, b) => {
        const difference = Date.parse(b.updated_at) - Date.parse(a.updated_at);
        return sort === "newest" ? difference : -difference;
      });
  }, [items, locale, search, sort]);
  const openItems = filteredItems.filter(canRegisterForContest);
  const closedItems = filteredItems.filter((contest) => !canRegisterForContest(contest));
  const showSearchEmpty =
    !loading && Boolean(search.trim()) && filteredItems.length === 0;

  if (showEmpty) {
    return (
      <FullPageEmptyState
        title={t("catalog.emptyTitle")}
        description={t("catalog.emptyDescription")}
        size="large"
      />
    );
  }

  const renderContestCard = (contest: Contest) => {
    const bannerUrl = contest.cover_image_url?.trim() || contest.thumbnail_url?.trim() || null;
    const contestSlug = contest.slug?.trim() || null;
    const registrationDeadline = getEffectiveContestSubmissionDeadline(contest);
    const participantCount = contest.participants_count ?? 0;
    const compactParticipantCount = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(participantCount).toLowerCase();
    const applicantRows: PublicHackathonApplicant[] = applicantsQuery.data?.[contest.id] ?? [];
    const participants = applicantRows.slice(0, 3).map((applicant) => ({
      userId: applicant.user_id,
      avatarSeed: applicant.avatar_seed,
      avatarConfig: applicant.avatar_config,
      label: applicant.full_name?.trim() || applicant.username?.trim() || "",
    }));

    return (
      <NavLink
        key={contest.id}
        to={contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons"}
        onClick={(event) => {
          if (contestSlug) return;
          event.preventDefault();
          toast.error(t("catalog.missingSlug"));
        }}
        className="motion-hover-card group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`${t("catalog.viewContest")}: ${contest.title}`}
      >
        <article className="grid min-h-[202px] overflow-hidden rounded-md border border-border bg-surface-base transition-[border-color,box-shadow] duration-200 group-hover:border-primary/30 group-hover:shadow-md xl:h-[202px] xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_352px] xl:gap-x-10">
          <div className="order-2 flex min-w-0 flex-col px-3xl py-2xl xl:order-none">
            <h3 className="line-clamp-1 text-heading-medium font-display text-foreground">
              {contest.title}
            </h3>
            {contest.short_description || contest.tagline ? (
              <p className="mt-2 line-clamp-1 font-body text-body-medium leading-[1.4] tracking-[0.02em] text-foreground-subtle">
                {contest.short_description || contest.tagline}
              </p>
            ) : null}

            <Timestamp
              type="full"
              size="medium"
              className="mt-3 w-full flex-wrap gap-3 whitespace-normal"
              date={(
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge size="xsmall" color="gray" variant="outline">
                    {contestListLocationLabel(contest.mode ?? contest.location, translate, "catalog")}
                  </Badge>
                  {contest.host?.name ? (
                    <span className="inline-flex items-center gap-2 text-foreground-subtle">
                      {contest.host.logo_url ? (
                        <img src={contest.host.logo_url} alt="" className="size-5 rounded-full object-cover" />
                      ) : null}
                      {t("catalog.hostedBy", { name: contest.host.name })}
                    </span>
                  ) : null}
                </span>
              )}
              time={(
                <ParticipantSummary
                  count={participantCount}
                  participants={participants}
                  summary={t("catalog.participantsCount", { displayCount: compactParticipantCount })}
                  maxVisible={3}
                  avatarSize="Small"
                  groupLabel={t("catalog.participantsCount", { displayCount: participantCount })}
                  className="[&>span]:text-foreground-subtle"
                />
              )}
            />

            <div className="my-xl border-t border-border" />

            <div className="flex flex-wrap items-center gap-x-5xl gap-y-2md">
              {contest.prize_pool?.amount && Number(contest.prize_pool.amount) !== 0 ? (
                <div className="inline-flex min-w-0 flex-wrap items-center gap-2md">
                  <p className="text-body-small leading-[1.25] text-foreground-subtle">{t("public.prizes.total")}</p>
                  <p className="text-title-large font-body text-foreground tabular-nums">
                    {formatPrizeAmount(contest.prize_pool.amount, locale)} {contest.prize_pool.currency}
                  </p>
                </div>
              ) : null}

              {canRegisterForContest(contest) && registrationDeadline ? (
                <span className="inline-flex items-center gap-2md whitespace-nowrap">
                  <Trans
                    ns="contests"
                    i18nKey="catalog.registrationDeadlinePrefix"
                    values={{ date: new Date(registrationDeadline).toLocaleDateString(locale) }}
                    components={{
                      label: <span className="text-body-small leading-[1.25] text-foreground-subtle" />,
                      date: <span className="text-title-large font-body text-foreground" />,
                    }}
                  />
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={`relative order-first w-full overflow-hidden bg-surface-raised xl:order-none ${bannerUrl ? "aspect-[44/25] xl:h-full xl:aspect-auto" : "min-h-[202px] xl:h-full xl:min-h-0"
              }`}
          >
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt=""
                className="absolute inset-0 size-full object-cover object-center"
              />
            ) : null}
          </div>
        </article>
      </NavLink>
    );
  };

  return (
    <div
      className={`course-catalog-page container-app pb-8 pt-6 sm:py-8 ${showSearchEmpty
          ? "flex min-h-[calc(100svh-var(--app-header-height))] flex-col"
          : ""
        }`}
    >
      <main
        className={`course-catalog mx-auto w-full max-w-[1072px] ${showSearchEmpty ? "flex flex-1 flex-col" : ""
          }`}
      >
        <header className="mb-6">
          <h1 className="text-heading-large font-display text-foreground">
            {t("catalog.pageTitle")}
            <span className="ml-2 text-body-large font-body font-normal text-foreground-subtle">
              ({items.length})
            </span>
          </h1>
          <p className="mt-2 text-body-large text-catalog-subtitle">
            {search.trim() ? t("catalog.searchHeroDescription") : t("catalog.heroDescription")}
          </p>

          <div className="course-catalog-filters mt-6 grid grid-cols-1 gap-3 xl:grid-cols-[520px_352px] xl:gap-2">
            <div className="min-w-0">
              <Input
                type="text"
                variant="icon-leading"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("catalog.searchPlaceholder")}
                aria-label={t("catalog.searchPlaceholder")}
                renderTrailingContent={() => search ? (
                  <button
                    type="button"
                    aria-label={commonT("search.clear")}
                    onClick={() => setSearch("")}
                    className="flex size-8 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label={commonT("projects.sort.label")}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left font-body text-body-large text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span>
                  {commonT(sort === "newest" ? "projects.sort.newest" : "projects.sort.oldest")}
                </span>
                <ChevronDown className="size-4 shrink-0 text-foreground-muted" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-0 max-w-[calc(100vw-2rem)]"
              >
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) =>
                    setSort(value === "oldest" ? "oldest" : "newest")
                  }
                >
                  <DropdownMenuRadioItem className="text-body-large" value="newest">
                    {commonT("projects.sort.newest")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem className="text-body-large" value="oldest">
                    {commonT("projects.sort.oldest")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {showError ? (
          <div
            className="mt-6 rounded-lg border border-destructive/25 bg-destructive-muted p-6"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-sm font-semibold text-foreground">
              {t("catalog.errorTitle")}
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("catalog.errorDescription")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() => void catalogQuery.refetch()}
              >
                {t("catalog.retry")}
              </Button>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">{error}</p>
          </div>
        ) : null}

        <div
          className={`mobile-bleed-grid grid gap-4 sm:gap-6 ${showSearchEmpty ? "flex-1" : ""
            }`}
          aria-busy={loading}
          aria-live={
            loading
              ? "polite"
              : search.trim() && filteredItems.length === 0
                ? "polite"
                : showGrid
                  ? "polite"
                  : undefined
          }
        >
          {loading ? (
            <div className="contents">{CatalogGridSkeleton()}</div>
          ) : showSearchEmpty ? (
            <div className="flex items-center justify-center">
              <EmptyStateIllustration
                type="search"
                size="medium"
                title={t("catalog.searchEmptyTitle")}
                description={t("catalog.searchEmptyDescription")}
              />
            </div>
          ) : (
            <>
              {openItems.length > 0 ? (
                <section className="grid">
                  <div className="flex min-h-6 items-center gap-2.5">
                    <h2 className="course-catalog-section-title text-body-large font-medium text-foreground">
                      {t("catalog.openApplications")}
                    </h2>
                    <Chip size="xsmall" shape="circle">
                      {openItems.length}
                    </Chip>
                  </div>
                  <Separator className="mt-3" />
                  <div className="mt-4 grid gap-3">{openItems.map(renderContestCard)}</div>
                </section>
              ) : null}
              {closedItems.length > 0 ? (
                <section className="mt-8 grid">
                  <div className="flex min-h-6 items-center gap-2.5">
                    <h2 className="course-catalog-section-title text-body-large font-medium text-foreground">
                      {t("catalog.closedApplications")}
                    </h2>
                    <Chip size="xsmall" shape="circle">
                      {closedItems.length}
                    </Chip>
                  </div>
                  <Separator className="mt-3" />
                  <div className="mt-4 grid gap-3">{closedItems.map(renderContestCard)}</div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
