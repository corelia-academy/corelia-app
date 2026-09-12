import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { publicProjectDetailQueryOptions, publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import { Button } from "@/components/ui/button";
import { useLearningTranslation } from "./useLearningTranslation";

export function PracticeProjectField({ value, onChange }: { value?: string; onChange(value: string | undefined): void }) {
  const { t, i18n } = useLearningTranslation();
  const query = useInfiniteQuery(publicProjectDirectoryQueryOptions(i18n.language, "all", "newest"));
  const selected = useQuery(publicProjectDetailQueryOptions(value, i18n.language));
  const projects = (query.data?.pages.flatMap(page => page.items.map(entry => entry.project)) ?? []).filter(project => project.visibility === "public" && !project.blocked);
  const selectedProject = selected.data?.project;
  if (selectedProject?.visibility === "public" && !selectedProject.blocked && !projects.some(project => project.id === selectedProject?.id)) projects.push(selectedProject);
  return <div className="space-y-2">
    <label className="block text-sm">{t("learning.relatedProject")}
      <select id="learning-practice-related_project_id" value={value ?? ""} aria-busy={query.isPending} onChange={event => onChange(event.target.value || undefined)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-base px-3">
        <option value="">{t("learning.noRelatedProject")}</option>
        {value && !projects.some(project => project.id === value) && <option value={value}>{t("learning.relatedUnavailable")}</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
    </label>
    {query.hasNextPage && <Button type="button" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t("learning.moreProjects")}</Button>}
    {(query.isError || selected.isError) && <p role="alert">{t("learning.loadError")} <Button type="button" variant="outline" onClick={() => { void query.refetch(); if (value) void selected.refetch(); }}>{t("learning.retry")}</Button></p>}
  </div>;
}

export function PracticeProjectLink({ id, locale }: { id: string; locale?: string }) {
  const { t, i18n } = useLearningTranslation();
  const query = useQuery(publicProjectDetailQueryOptions(id, locale ?? i18n.language));
  if (query.isPending) return <p role="status">{t("learning.loading")}</p>;
  if (query.isError) return <p role="alert">{t("learning.loadError")} <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("learning.retry")}</Button></p>;
  const project = query.data?.project;
  if (!project || project.visibility !== "public" || project.blocked) return <p className="text-sm text-foreground-muted">{t("learning.relatedUnavailable")}</p>;
  return <Link to={`/projects/${encodeURIComponent(project.slug || project.id)}`} className="block rounded-xl border border-border p-4 text-primary underline">{t("learning.relatedProject")}: {project.title}</Link>;
}
