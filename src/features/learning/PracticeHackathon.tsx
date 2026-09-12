import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import { Button } from "@/components/ui/button";
import { useLearningTranslation } from "./useLearningTranslation";

export function PracticeHackathonField({ value, onChange }: { value?: string; onChange(value: string | undefined): void }) {
  const { t, i18n } = useLearningTranslation();
  const query = useQuery(publicHackathonCatalogQueryOptions(i18n.language));
  const contests = (query.data ?? []).filter(contest => Boolean(contest.slug));
  const missing = value && !contests.some(contest => contest.id === value);
  return <div className="space-y-2">
    <label className="block text-sm">{t("learning.relatedHackathon")}
      <select id="learning-practice-related_hackathon_id" value={value ?? ""} aria-busy={query.isPending} onChange={event => onChange(event.target.value || undefined)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-base px-3">
        <option value="">{t("learning.noRelatedHackathon")}</option>
        {missing && <option value={value}>{t("learning.relatedUnavailable")}</option>}
        {contests.map(contest => <option key={contest.id} value={contest.id}>{contest.title}</option>)}
      </select>
    </label>
    <p className="text-sm text-foreground-muted">{t("learning.relatedHackathonHint")}</p>
    {query.isError && <p role="alert">{t("learning.loadError")} <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("learning.retry")}</Button></p>}
  </div>;
}

export function PracticeHackathonLink({ id, locale }: { id: string; locale?: string }) {
  const { t, i18n } = useLearningTranslation();
  const query = useQuery(publicHackathonCatalogQueryOptions(locale ?? i18n.language));
  const contest = query.data?.find(item => item.id === id);
  if (query.isPending) return <p role="status">{t("learning.loading")}</p>;
  if (query.isError) return <p role="alert">{t("learning.loadError")} <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("learning.retry")}</Button></p>;
  if (!contest?.slug) return <p className="text-sm text-foreground-muted">{t("learning.relatedUnavailable")}</p>;
  return <Link to={`/hackathons/${encodeURIComponent(contest.slug)}`} className="block rounded-xl border border-border p-4 text-primary underline">{t("learning.relatedHackathon")}: {contest.title}</Link>;
}
