import { useCallback } from "react";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import { NavLink } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/ui/timestamp";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import type { PublicHackathonApplicant } from "@/lib/hackathonApplicants";
import { canRegisterForContest, getEffectiveContestSubmissionDeadline } from "@/lib/hackathons";
import type { Contest } from "@/types/hackathons";
import { formatPrizeAmount } from "@/pages/hackathon-detail/utils/formatPrizeAmount";
import { contestListLocationLabel } from "@/features/hackathons/list/contestListFormatters";

/** Hackathon catalog card shared by the Hackathons catalog and global search results. */
export function ContestCatalogCard({
  contest,
  applicants = [],
}: {
  contest: Contest;
  applicants?: PublicHackathonApplicant[];
}) {
  const { t, i18n } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const bannerUrl = contest.cover_image_url?.trim() || contest.thumbnail_url?.trim() || null;
  const contestSlug = contest.slug?.trim() || null;
  const registrationDeadline = getEffectiveContestSubmissionDeadline(contest);
  const participantCount = contest.participants_count ?? 0;
  const compactParticipantCount = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(participantCount).toLowerCase();
  const participants = applicants.slice(0, 3).map((applicant) => ({
    userId: applicant.user_id,
    avatarSeed: applicant.avatar_seed,
    avatarConfig: applicant.avatar_config,
    label: applicant.full_name?.trim() || applicant.username?.trim() || "",
  }));

  return (
    <NavLink
      to={contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons"}
      onClick={(event) => {
        if (contestSlug) return;
        event.preventDefault();
        toast.error(t("catalog.missingSlug"));
      }}
      className="motion-hover-card group block min-w-0 @container rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${t("catalog.viewContest")}: ${contest.title}`}
    >
      <article className="grid min-h-[202px] overflow-hidden rounded-md border border-border bg-surface-base transition-shadow duration-200 group-hover:shadow-md xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_352px] xl:gap-x-[clamp(2.25rem,calc(40.8cqi_-_328px),clamp(2.75rem,calc(20.5cqi_-_139.6px),5rem))]">
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
                      <img src={optimizedImageUrl(contest.host.logo_url, { width: 20, resize: "contain" })} srcSet={optimizedImageSrcSet(contest.host.logo_url, 20, { resize: "contain" })} decoding="async" alt="" className="size-5 rounded-full object-cover" />
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
              src={optimizedImageUrl(bannerUrl, { width: 480 })} srcSet={optimizedImageSrcSet(bannerUrl, 480)} decoding="async"
              alt=""
              className="absolute inset-0 size-full object-cover object-center"
            />
          ) : null}
        </div>
      </article>
    </NavLink>
  );
}
