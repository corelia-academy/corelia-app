import { BookmarkSimple, Briefcase, MoneyWavy } from "@phosphor-icons/react";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatJobDate, formatJobSalary, humanizeJobSlug } from "@/features/jobs/jobFormat";
import { cn } from "@/lib/utils";
import type { Job, UserJobState } from "@/types/jobs";

type Props = {
  job: Job;
  publicAppearance?: boolean;
  state?: UserJobState | null;
  busy?: boolean;
  onToggleSaved?: () => void;
};

export function JobCard({ publicAppearance = false, job, state, busy, onToggleSaved }: Props) {
  const { t, i18n } = useTranslation("jobs");
  const salary = formatJobSalary(job, i18n.language);
  const tags = [...new Set([job.primary_role, ...job.domains, ...job.required_skills].filter(Boolean))];
  return (
    <Card className={cn("motion-hover-card group h-full rounded-md border-border transition-colors hover:border-primary/35", publicAppearance && "public-job-card min-w-0")}>
      <CardContent className="flex h-full flex-col gap-6 p-4!">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised">
            {job.company_logo_url
              ? <img src={optimizedImageUrl(job.company_logo_url, { width: 48, resize: "contain" })} srcSet={optimizedImageSrcSet(job.company_logo_url, 48, { resize: "contain" })} alt="" className="size-full object-contain" />
              : <Briefcase className="size-6 text-foreground-subtle" weight="duotone" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/jobs/${job.slug}`} title={job.title} className="line-clamp-1 font-display text-heading-medium text-foreground hover:text-primary">
              {job.title}
            </Link>
            <p className="mt-1 truncate text-body-small text-foreground-subtle">{job.company_name} · {formatJobDate(job.posted_at ?? job.first_seen_at, i18n.language)}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-title-large text-foreground">
            <MoneyWavy className="size-5 shrink-0 text-foreground-subtle" weight="duotone" aria-hidden />
            <span className="min-w-0 truncate">{salary ?? t("card.salaryNotShown")}</span>
          </div>
          {job.summary ? <p className="line-clamp-3 text-body-medium leading-[1.4] text-catalog-subtitle">{job.summary}</p> : null}
          {tags.length ? (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => <Badge key={tag} size="xsmall" variant="filled" color="gray">{humanizeJobSlug(tag)}</Badge>)}
              {tags.length > 2 ? <Badge size="xsmall" variant="filled" color="gray" className="rounded-sm">+{tags.length - 2}</Badge> : null}
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-body-small text-foreground-subtle">
            {job.remote_type ? <Badge size="xsmall" color="gray">{t(`values.${job.remote_type}`, { defaultValue: humanizeJobSlug(job.remote_type) })}</Badge> : null}
            <span className="shrink-0 whitespace-nowrap">{t(`values.${job.employment_type}`, { defaultValue: humanizeJobSlug(job.employment_type) })}</span>
            {job.location_text ? <><span aria-hidden className="h-5 w-px shrink-0 bg-border" /><span className="min-w-0 truncate" title={job.location_text}>{job.location_text}</span></> : null}
          </div>
          {onToggleSaved ? (
            <button type="button" disabled={busy} aria-label={state?.saved ? t("actions.unsave") : t("actions.save")} onClick={onToggleSaved} className="relative -my-3 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground-subtle transition-colors after:absolute after:-inset-x-3 after:inset-y-0 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
              <BookmarkSimple className={cn("size-5", state?.saved && "text-primary")} weight={state?.saved ? "fill" : "duotone"} aria-hidden />
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
