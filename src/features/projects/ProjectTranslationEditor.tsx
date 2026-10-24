import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchProjectTranslationStatus,
  requestProjectTranslation,
  type ProjectTranslationStatus,
} from "@/lib/projectSubmission";
import { projectErrorMessage } from "@/lib/projectErrors";
import { CONTENT_LOCALES, LOCALE_META, isContentLocale, type ContentLocale } from "@/lib/locales";

const STATUS_COLOR: Record<ProjectTranslationStatus, BadgeColor> = {
  fresh: "success",
  stale: "gray",
  pending: "primary",
  failed: "error",
  manual: "warning",
};
// Poll while a translation is queued; the worker runs every minute.
const ACTIVE_POLL_MS = 15_000;

function projectTranslationStatusKey(projectId: string) {
  return ["projectTranslationStatus", projectId] as const;
}

/**
 * Owners edit only the primary language. Other languages are translated by a
 * background job after each save; this panel shows their status and lets the
 * owner add a language or ask for a fresh translation.
 */
export function ProjectTranslationEditor({ projectId, persisted, primaryLocale, disabled }: {
  projectId: string; persisted: boolean; primaryLocale: ContentLocale; disabled: boolean;
}) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: projectTranslationStatusKey(projectId),
    queryFn: () => fetchProjectTranslationStatus(projectId),
    enabled: persisted,
    refetchInterval: query => query.state.data?.some(row => row.status === "pending" || row.status === "stale") ? ACTIVE_POLL_MS : false,
  });
  const request = useMutation({
    mutationFn: (locale: ContentLocale) => requestProjectTranslation(projectId, locale),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectTranslationStatusKey(projectId) }),
  });
  const rows = (statusQuery.data ?? []).filter(row => row.locale !== primaryLocale);
  const available = CONTENT_LOCALES.filter(locale => locale !== primaryLocale && !rows.some(row => row.locale === locale));
  const [added, setAdded] = useState<ContentLocale | "">("");
  const addTarget = added && available.includes(added) ? added : available[0];

  if (!persisted) return <p className="text-xs text-foreground-muted">{t("projects.translation.saveFirst")}</p>;

  return <div className="space-y-3">
    <p className="text-xs text-foreground-muted">{t("projects.translation.autoHint")}</p>
    {rows.length ? <ul aria-label={t("projects.translation.languages")} className="space-y-2">
      {rows.map(row => <li key={row.locale} className="flex flex-wrap items-center gap-2">
        <span lang={row.locale} className="min-w-24 text-sm">{LOCALE_META[row.locale].endonym}</span>
        <Badge color={STATUS_COLOR[row.status]}>{t(`projects.translation.status.${row.status}`)}</Badge>
        {row.status !== "pending" ? <Button type="button" variant="cta" hierarchy="tertiary" disabled={disabled || request.isPending} onClick={() => request.mutate(row.locale)}>
          {t("projects.translation.retranslate")}
        </Button> : null}
      </li>)}
    </ul> : null}
    {available.length && addTarget ? <div className="flex flex-wrap items-center gap-2">
      <select aria-label={t("projects.translation.addLanguage")} className="h-10 rounded-lg border border-border bg-surface-base px-3 text-sm" value={addTarget} disabled={disabled || request.isPending} onChange={event => { if (isContentLocale(event.target.value)) setAdded(event.target.value); }}>
        {available.map(locale => <option key={locale} value={locale}>{LOCALE_META[locale].endonym}</option>)}
      </select>
      <Button type="button" variant="cta" hierarchy="secondary" disabled={disabled || request.isPending} onClick={() => request.mutate(addTarget)}>
        {t("projects.translation.translate", { target: LOCALE_META[addTarget].endonym })}
      </Button>
    </div> : null}
    {request.isError ? <p role="alert" className="text-sm text-destructive">{projectErrorMessage(request.error, t)}</p> : null}
    {statusQuery.isError ? <p role="alert" className="text-sm text-destructive">{projectErrorMessage(statusQuery.error, t)}</p> : null}
  </div>;
}
