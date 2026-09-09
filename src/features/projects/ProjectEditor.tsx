import { ProjectTranslationEditor } from "./ProjectTranslationEditor";
import type { ProjectContent } from "@/types/projects";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, ExternalLink, LoaderCircle } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEffectiveContestSubmissionDeadline, isPastContestSubmissionDeadline } from "@/lib/hackathons";
import { generateCanonicalProjectSlug } from "@/lib/hackathonContract";
import { normalizeSlugDraft } from "@/lib/slug";
import { projectErrorMessage } from "@/lib/projectErrors";
import type { Contest } from "@/types/hackathons";
import type { Project } from "@/types/projects";
import { ProjectMarkdownEditor } from "./ProjectMarkdownEditor";
import { ProjectResourcesEditor } from "./ProjectResourcesEditor";
import { ProjectMediaEditor } from "./ProjectMediaEditor";
import { ProjectTeamEditor } from "./ProjectTeamEditor";
import { projectDraft, contentForLocale, changePrimaryLocale, type ProjectDraft } from "./projectEditorDraft";
import { useProjectDraft } from "./useProjectDraft";

export type ProjectEditorSave = { draft: ProjectDraft; teamIds: string[]; removedPaths: string[] };

export function ProjectEditor({ projectId, userId, project, contest, onSave, onSaved }: {
  projectId: string; userId: string; project?: Project; contest?: Contest | null;
  onSave: (value: ProjectEditorSave) => Promise<string>;
  onSaved: (slug: string) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const [initial] = useState(() => projectDraft(project, i18n?.resolvedLanguage ?? i18n?.language ?? "vi"));
  const { draft, setDraft, dirty, clear, recovered, dismissRecovery } = useProjectDraft(
    `corelia:project-draft:${userId}:${project?.id ?? contest?.id ?? "new"}`,
    initial, t("projects.editor.leave"),
  );
  const [contentLocale, setContentLocale] = useState<"vi" | "en">(draft.primaryLocale);
  const content = contentForLocale(draft, contentLocale);
  const isPrimary = contentLocale === draft.primaryLocale;
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [uploading, setUploading] = useState(false);
  const [closed, setClosed] = useState(() => Boolean(contest && isPastContestSubmissionDeadline(contest)));
  useEffect(() => {
    if (!contest || closed) return;
    const deadline = getEffectiveContestSubmissionDeadline(contest);
    if (!deadline || !Number.isFinite(Date.parse(deadline))) return;
    const timer = window.setInterval(() => setClosed(isPastContestSubmissionDeadline(contest)), 1000);
    return () => window.clearInterval(timer);
  }, [contest, closed]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const slug = draft.slug ? generateCanonicalProjectSlug(draft.slug) : "";
  const groups = contest ? [
    { key: "tracks" as const, label: t("projects.filters.tracks"), options: contest.tracks ?? [] },
    { key: "sectors" as const, label: t("projects.filters.sectors"), options: contest.sectors ?? [] },
    { key: "tech" as const, label: t("projects.filters.techStacks"), options: contest.tech_stacks ?? [] },
  ] : [];
  const publishing = Boolean(contest) || draft.visibility !== "private";
  const hasContent = (value: string) => /[\p{L}\p{N}]/u.test(value);
  const requirements = [
    { label: t("projects.form.title"), done: Boolean(draft.title.trim()), href: "#project-basics" },
    { label: t("projects.form.slug"), done: Boolean(slug), href: "#project-basics" },
    ...(publishing ? [
      { label: t("projects.form.summary"), done: hasContent(draft.summary), href: "#project-basics" },
      { label: t("projects.editor.description"), done: hasContent(draft.description), href: "#project-story" },
    ] : []),
    ...(contest ? [
      { label: t("projects.editor.progress"), done: hasContent(draft.progress), href: "#project-story" },
    ] : []),
    ...groups.map(group => ({ label: group.label, done: draft[group.key].length > 0, href: "#project-categories" })),
  ];
  const withinLimits = draft.title.length <= 160 && draft.slug.length <= 160
    && (["vi", "en"] as const).every(locale => { const value = contentForLocale(draft, locale); return value.title.length <= 160 && value.summary.length <= 1000 && value.description.length <= 20000 && value.progress.length <= 10000; })
    && [draft.demo, draft.repo, draft.slide, draft.video, draft.pitchVideo].every(value => value.length <= 2048);
  const complete = requirements.every(item => item.done) && withinLimits;
  const mutation = useMutation({
    mutationFn: () => onSave({ draft: { ...draft, slug }, teamIds, removedPaths }),
    onSuccess: result => { clear(); onSaved(result); },
    onError: () => requestAnimationFrame(() => errorRef.current?.focus()),
  });
  const back = project ? `/projects/${project.slug}` : contest ? `/hackathons/${contest.slug}/projects` : "/projects";
  function change<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    dismissRecovery();
    setDraft(current => ({ ...current, [key]: value }));
  }

  function changeContent(key: keyof ProjectContent, value: string) {
    dismissRecovery();
    setDraft(current => {
      if (contentLocale !== current.primaryLocale) return { ...current, locales: { ...current.locales, [contentLocale]: { ...contentForLocale(current, contentLocale), [key]: value } } };
      return { ...current, [key]: value, ...(key === "title" && !slugTouched ? { slug: value.trim() ? generateCanonicalProjectSlug(value) : "" } : {}) };
    });
  }

  return <div className="container-app py-6 sm:py-8">
    <Button variant="ghost" render={<NavLink to={back} />} nativeButton={false}><ArrowLeft className="size-4" />{t("projects.form.back")}</Button>
    <header className="my-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-label-small font-body uppercase tracking-widest text-primary">{t("projects.editor.workspace")}</p><h1 className="mt-2 text-heading-large font-display">{t(project ? "projects.form.editTitle" : "projects.form.createTitle")}</h1><p className="mt-2 max-w-2xl text-body-medium font-body text-foreground-muted">{t("projects.editor.intro")}</p></div>
      {contest ? <NavLink to={`/hackathons/${contest.slug}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-base px-4 py-2 text-cta-medium font-body"><span className="truncate">{contest.title}</span><ExternalLink className="size-4 shrink-0" /></NavLink> : null}
    </header>
    {closed ? <p role="status" className="mb-5 rounded-lg border border-border bg-surface-raised p-4 text-body-medium font-body">{t("projects.errors.deadline")}</p> : null}
    {recovered ? <p role="status" className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-body-medium font-body">{t("projects.editor.recovered")}</p> : null}
    <form onSubmit={event => { event.preventDefault(); if (complete && !closed && !uploading && !mutation.isPending) mutation.mutate(); }} className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <fieldset disabled={mutation.isPending || closed} className="min-w-0 space-y-6">
        <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
          <h2 className="text-lg font-semibold">{t("projects.translation.languages")}</h2>
          <div role="group" aria-label={t("projects.translation.languages")} className="flex flex-wrap gap-2">
            {(["vi", "en"] as const).map(locale => <Button key={locale} type="button" variant={contentLocale === locale ? "default" : "outline"} aria-pressed={contentLocale === locale} onClick={() => setContentLocale(locale)}>{locale === "vi" ? "Tiếng Việt" : "English"}{draft.primaryLocale === locale ? ` · ${t("projects.translation.primary")}` : ""}</Button>)}
          </div>
          <p className="text-sm text-foreground-muted">{t("projects.translation.optional")}</p>
          {!isPrimary ? <Button type="button" variant="outline" onClick={() => { dismissRecovery(); setDraft(current => changePrimaryLocale(current, contentLocale)); }}>{t("projects.translation.makePrimary")}</Button> : null}
          <ProjectTranslationEditor projectId={projectId} draft={draft} disabled={closed || mutation.isPending} onApply={(locale, translated) => { dismissRecovery(); setDraft(current => ({ ...current, locales: { ...current.locales, [locale]: translated } })); setContentLocale(locale); }} />
        </section>
        <section id="project-basics" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
          <h2 className="text-heading-medium font-display">{t("projects.editor.basics")}</h2><p className="mt-1 text-body-medium font-body text-foreground-muted">{t("projects.editor.basicsHint")}</p>
          <div className="mt-6 space-y-5">
            <label className="block text-label-medium font-body">{t("projects.form.title")} {isPrimary ? <span className="text-primary">*</span> : null}<Input className="mt-2" required={isPrimary} maxLength={160} value={content.title} onChange={event => changeContent("title", event.target.value)} aria-describedby="project-title-hint" placeholder={t("projects.editor.titlePlaceholder")} /><span id="project-title-hint" className="mt-2 block text-body-small text-foreground-muted">{t("projects.editor.titleHint")}</span><span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: content.title.length, limit: 160 })}</span></label>
            <label className="block text-label-medium font-body">{t("projects.form.slug")} <span className="text-primary">*</span><Input aria-describedby="project-slug-hint" className="mt-2" required maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={event => { setSlugTouched(true); change("slug", normalizeSlugDraft(event.target.value)); }} onBlur={() => { if (draft.slug.trim()) change("slug", slug); }} /><span id="project-slug-hint" className="mt-2 block text-body-small text-foreground-muted">{t("projects.editor.slugHint")}</span><span className="mt-1 block break-all text-body-small font-body text-foreground-muted">/projects/{slug || "…"}</span><span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: draft.slug.length, limit: 160 })}</span></label>
            <label className="block text-label-medium font-body">{t("projects.form.summary")}{publishing && isPrimary ? <span className="text-primary"> *</span> : null}<textarea aria-describedby="project-summary-hint" required={publishing && isPrimary} className="mt-2 min-h-40 w-full rounded-md border border-border bg-background px-3 py-2 text-body-medium font-body" rows={6} maxLength={1000} value={content.summary} placeholder={t("projects.editor.summaryPlaceholder")} onChange={event => changeContent("summary", event.target.value)} /><span id="project-summary-hint" className="mt-2 block text-body-small text-foreground-muted">{t("projects.editor.summaryHint")}</span><span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: content.summary.length, limit: 1000 })}</span></label>
          </div>
        </section>
        <section id="project-story" className="scroll-mt-24 space-y-5 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="text-heading-medium font-display">{t("projects.editor.story")}</h2>{([['description',20000],['progress',10000]] as const).map(([key,max]) => <ProjectMarkdownEditor key={key} label={t(`projects.editor.${key}`)} value={content[key]} onChange={value => changeContent(key,value)} maxLength={max} required={isPrimary && (key === "description" ? publishing : Boolean(contest))} hint={t(`projects.editor.${key}Hint`)} placeholder={t(`projects.editor.${key}Placeholder`)} rows={key === "description" ? 10 : 6} />)}</section>
        <section id="project-media" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="mb-5 text-heading-medium font-display">{t("projects.editor.media")}</h2><ProjectMediaEditor projectId={projectId} logo={draft.logo} screenshots={draft.screenshots} onLogoChange={logo => change("logo", logo)} onScreenshotsChange={screenshots => change("screenshots", screenshots)} deleteOnRemove={false} onRemovePath={path => setRemovedPaths(current => [...new Set([...current, path])])} onUploadingChange={setUploading} /></section>
        <ProjectResourcesEditor draft={draft} onChange={change} />
        {contest ? <section id="project-categories" className="scroll-mt-24 space-y-6 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><div><h2 className="text-heading-medium font-display">{t("projects.editor.categories")}</h2><p className="mt-1 text-body-medium font-body text-foreground-muted">{t("projects.editor.categoriesHint")}</p></div>{groups.map(group => <fieldset key={group.key}><legend className="text-label-medium font-body">{group.label} <span className="text-primary">*</span></legend><div className="mt-3 flex flex-wrap gap-2">{group.options.filter(option => option.active !== false || draft[group.key].includes(option.id)).map(option => <label key={option.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-body-medium font-body ${draft[group.key].includes(option.id) ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background'}`}><input type="checkbox" className="accent-primary" checked={draft[group.key].includes(option.id)} onChange={() => change(group.key,draft[group.key].includes(option.id) ? draft[group.key].filter(id=>id!==option.id) : [...draft[group.key],option.id])} />{option.name}</label>)}</div></fieldset>)}</section> : null}
        <section id="project-team" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="mb-5 text-heading-medium font-display">{t("projects.editor.team")}</h2><ProjectTeamEditor projectId={projectId} sourceType={project?.source_type ?? (contest ? "hackathon" : "standalone")} sourceId={project?.source_id ?? contest?.id} persisted={Boolean(project)} selectedIds={teamIds} onSelectedIdsChange={setTeamIds} /></section>
      </fieldset>
      <aside className="space-y-5 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-5"><h2 className="text-heading-medium font-display">{t("projects.editor.checklist")} ({draft.primaryLocale.toUpperCase()})</h2><p className="mt-2 text-body-small text-foreground-muted">{t("projects.editor.checklistHint")}</p><ul className="mt-4 space-y-3">{requirements.map(item => <li key={item.label}><a href={item.href} className="flex items-center gap-2 text-body-medium font-body">{item.done ? <Check className="size-4 text-primary" /> : <Circle className="size-4 text-foreground-subtle" />}<span>{item.label}</span><span className="sr-only">{t(item.done ? "projects.editor.complete" : "projects.editor.missing")}</span></a></li>)}</ul>
          {contest ? <p className="mt-5 text-body-small font-body text-foreground-muted">{t("projects.editor.publicHint")}</p> : <label className="mt-5 block text-label-medium font-body">{t("projects.form.visibility")}<select value={draft.visibility} onChange={event=>change("visibility", event.target.value as ProjectDraft['visibility'])} disabled={mutation.isPending} className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3">{(['public','unlisted','private'] as const).map(value=><option key={value} value={value}>{t(`projects.editor.${value}`)}</option>)}</select></label>}
          {!withinLimits ? <p role="alert" className="mt-4 text-body-small font-body text-destructive">{t("projects.editor.limitHint")}</p> : null}
          {!complete && withinLimits ? <p className="mt-4 text-body-small font-body text-foreground-muted">{t("projects.editor.requiredHint")}</p> : null}
          <Button className="mt-5 w-full" type="submit" disabled={mutation.isPending || uploading || closed || !complete}>{mutation.isPending || uploading ? <LoaderCircle className="size-4 animate-spin" /> : null}{t(uploading ? "projects.editor.uploading" : mutation.isPending ? "projects.form.saving" : project ? "projects.form.save" : "projects.form.create")}</Button>
          <p className="mt-3 text-body-small font-body text-foreground-muted" role="status">{t(dirty ? "projects.editor.unsaved" : "projects.editor.ready")}</p>
        </div>
        {mutation.isError ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-body-medium font-body text-destructive">{projectErrorMessage(mutation.error,t)}<p className="mt-2">{t("projects.editor.retryHint")}</p></div> : null}
      </aside>
    </form>
  </div>;
}
