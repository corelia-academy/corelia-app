import { Bookmark, BriefcaseBusiness, Building2, Clock3, EyeOff, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatJobDate, formatJobSalary, humanizeJobSlug } from "@/features/jobs/jobFormat";
import type { Job, UserJobState } from "@/types/jobs";

type Props = {
  job: Job;
  state?: UserJobState | null;
  busy?: boolean;
  onToggleSaved?: () => void;
  onToggleApplied?: () => void;
  onHide?: () => void;
};

export function JobCard({ job, state, busy, onToggleSaved, onToggleApplied, onHide }: Props) {
  const { t, i18n } = useTranslation("jobs");
  const salary = formatJobSalary(job, i18n.language);
  return (
    <Card className="group h-full transition-colors hover:border-primary/35">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
            {job.company_logo_url ? <img src={job.company_logo_url} alt="" className="size-full object-contain p-1" /> : <Building2 className="size-5 text-foreground-subtle" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/jobs/${job.slug}`} className="line-clamp-2 font-semibold text-foreground hover:text-primary">
              {job.title}
            </Link>
            <p className="mt-1 truncate text-sm text-foreground-muted">{job.company_name}</p>
          </div>
          {onToggleSaved ? (
            <Button type="button" size="icon-sm" variant="ghost" disabled={busy} aria-label={state?.saved ? t("actions.unsave") : t("actions.save")} onClick={onToggleSaved}>
              <Bookmark className={`size-4 ${state?.saved ? "fill-current text-primary" : ""}`} aria-hidden />
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{job.location_text || humanizeJobSlug(job.remote_type)}</span>
          <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="size-3.5" aria-hidden />{humanizeJobSlug(job.employment_type)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden />{formatJobDate(job.posted_at ?? job.first_seen_at, i18n.language)}</span>
        </div>
        {job.summary ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-foreground-muted">{job.summary}</p> : null}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[job.primary_role, ...job.domains, ...job.required_skills].filter(Boolean).slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-full bg-surface-raised px-2 py-1 text-xs text-foreground-muted">{humanizeJobSlug(tag)}</span>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="text-sm font-semibold text-foreground">{salary ?? t("card.salaryNotShown")}</div>
          <div className="flex gap-1">
            {onToggleApplied ? <Button type="button" size="sm" variant={state?.applied ? "secondary" : "outline"} disabled={busy} onClick={onToggleApplied}>{state?.applied ? t("actions.applied") : t("actions.markApplied")}</Button> : null}
            {onHide ? <Button type="button" size="icon-sm" variant="ghost" disabled={busy} aria-label={t("actions.hide")} onClick={onHide}><EyeOff className="size-4" aria-hidden /></Button> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
