import { ProjectTranslationEditor } from "./ProjectTranslationEditor";
import type { ProjectContent } from "@/types/projects";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Check, Circle, ExternalLink, LoaderCircle } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { BackLink } from "@/components/navigation/BackLink";
import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressCircle } from "@/components/ui/progress";
import { Checkbox, CheckboxCard } from "@/components/ui/selection";
import { Separator } from "@/components/ui/separator";
import { canEditContestProject, isPastContestSubmissionDeadline } from "@/lib/hackathons";
import { generateCanonicalProjectSlug } from "@/lib/hackathonContract";
import { normalizeSlugDraft } from "@/lib/slug";
import { projectErrorMessage } from "@/lib/projectErrors";
import { listProjectTaxonomyOptions, type ProjectTaxonomyOption } from "@/lib/projectTaxonomy";
import type { Contest } from "@/types/hackathons";
import { MAX_PROJECT_TEAM_SIZE } from "@/types/projects";
import type { Project } from "@/types/projects";
import { ProjectMarkdownEditor } from "./ProjectMarkdownEditor";
import { ProjectResourcesEditor } from "./ProjectResourcesEditor";
import { ProjectMediaEditor } from "./ProjectMediaEditor";
import { ProjectTeamEditor } from "./ProjectTeamEditor";
import { ProjectTaxonomyPicker } from "./ProjectTaxonomyPicker";
import { projectDraft, contentForLocale, changePrimaryLocale, type ProjectDraft } from "./projectEditorDraft";
import { useProjectDraft } from "./useProjectDraft";

gsap.registerPlugin(ScrollToPlugin);

export type ProjectEditorSave = { draft: ProjectDraft; teamIds: string[]; removedPaths: string[] };

export function ProjectEditor({ projectId, userId, project, contest, bypassDeadline = false, onSave, onSaved }: {
  projectId: string; userId: string; project?: Project; contest?: Contest | null;
  bypassDeadline?: boolean;
  onSave: (value: ProjectEditorSave) => Promise<string>;
  onSaved: (slug: string) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const uiLocale = i18n?.resolvedLanguage ?? i18n?.language ?? "vi";
  const [initial] = useState(() => projectDraft(project, uiLocale));
  const { draft, setDraft, dirty, clear, recovered, dismissRecovery } = useProjectDraft(
    `corelia:project-draft:${userId}:${project?.id ?? contest?.id ?? "new"}`,
    initial, t("projects.editor.leave"),
  );
  const [contentLocale, setContentLocale] = useState<"vi" | "en">(draft.primaryLocale);
  const content = contentForLocale(draft, contentLocale);
  const isPrimary = contentLocale === draft.primaryLocale;
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(Date.now);
  const closed = Boolean(contest && !bypassDeadline && (project ? !canEditContestProject(contest, now) : isPastContestSubmissionDeadline(contest, now)));
  useEffect(() => {
    if (!contest || bypassDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [contest, bypassDeadline]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const checklistScrollTweenRef = useRef<{ kill: () => void } | null>(null);
  useEffect(() => {
    return () => {
      checklistScrollTweenRef.current?.kill();
    };
  }, []);
  const slug = draft.slug ? generateCanonicalProjectSlug(draft.slug) : "";
  const taxonomyQuery = useQuery({
    queryKey: ["projects", "taxonomy", uiLocale],
    queryFn: () => listProjectTaxonomyOptions(uiLocale),
    staleTime: 5 * 60_000,
    enabled: Boolean(contest),
  });
  const systemOptions = taxonomyQuery.data ?? [];
  const withSelectedLegacy = (kind: "sector" | "technology", legacy: NonNullable<Contest["sectors"]>, selectedIds: string[]): ProjectTaxonomyOption[] => {
    const current = systemOptions.filter((option) => option.kind === kind);
    const known = new Set(current.map((option) => option.id));
    return [...current, ...legacy.filter((option) => selectedIds.includes(option.id) && !known.has(option.id)).map((option, index) => ({ id: option.id, kind, name: option.name, sort_order: current.length + index }))];
  };
  const sectorOptions = contest ? withSelectedLegacy("sector", contest.sectors ?? [], draft.sectors) : [];
  const techOptions = contest ? withSelectedLegacy("technology", contest.tech_stacks ?? [], draft.tech) : [];
  const publishing = Boolean(contest) || draft.visibility !== "private";
  const contestSubmission = Boolean(contest && !project);
  const contentLimits = { title: 160, summary: 1000, description: 20000, progress: 10000 };
  const hasContent = (value: string) => /[\p{L}\p{N}]/u.test(value);
  const getSectionProgress = (validFields: boolean[]) => {
    const completedFields = validFields.filter(Boolean).length;
    return {
      done: validFields.length > 0 && completedFields === validFields.length,
      percentage: validFields.length
        ? Math.round((completedFields / validFields.length) * 100)
        : 0,
    };
  };
  const requirements = [
    { label: t("projects.form.title"), done: Boolean(draft.title.trim()), href: "#project-basics" },
    { label: t("projects.form.slug"), done: Boolean(slug), href: "#project-basics" },
    ...(publishing ? [
      { label: t("projects.form.summary"), done: hasContent(draft.summary), href: "#project-basics" },
      { label: t("projects.editor.description"), done: hasContent(draft.description), href: "#project-story" },
    ] : []),
    ...(contest ? [{ label: t("projects.filters.tracks"), done: draft.tracks.length > 0, href: "#project-categories" }] : []),
  ];
  const submissionSections = [
    {
      label: t("projects.editor.overview"),
      ...getSectionProgress([
        Boolean(draft.title.trim()) && draft.title.length <= contentLimits.title,
        Boolean(draft.slug) &&
        draft.slug.length <= 160 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug),
        hasContent(draft.summary) && draft.summary.length <= contentLimits.summary,
      ]),
      href: "#project-basics",
    },
    {
      label: t("projects.editor.submissionStory"),
      ...getSectionProgress([
        hasContent(draft.description) &&
        draft.description.length <= contentLimits.description,
      ]),
      href: "#project-story",
    },
    {
      label: t("projects.form.logo"),
      ...getSectionProgress([Boolean(draft.logo?.path)]),
      href: "#project-media",
    },
  ];
  const checklistItems = contestSubmission ? submissionSections : requirements;
  const withinLimits = draft.title.length <= contentLimits.title && draft.slug.length <= 160
    && (["vi", "en"] as const).every(locale => { const value = contentForLocale(draft, locale); return value.title.length <= contentLimits.title && value.summary.length <= contentLimits.summary && value.description.length <= contentLimits.description && value.progress.length <= contentLimits.progress; })
    && [draft.demo, draft.repo, draft.slide, draft.video, draft.pitchVideo].every(value => value.length <= 2048);
  const complete = requirements.every(item => item.done) && withinLimits && (!contestSubmission || Boolean(draft.logo?.path));
  const mutation = useMutation({
    mutationFn: () => onSave({ draft: { ...draft, slug }, teamIds, removedPaths }),
    onSuccess: result => { clear(); onSaved(result); },
    onError: () => requestAnimationFrame(() => errorRef.current?.focus()),
  });
  const back = project ? `/projects/${project.slug}` : contest ? `/hackathons/${contest.slug}/projects` : "/projects";
  function handleChecklistScroll(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    event.preventDefault();
    if (window.location.hash !== href) {
      window.history.pushState(null, "", href);
    }

    checklistScrollTweenRef.current?.kill();

    let ancestor = target.parentElement;
    let scrollContainer: HTMLElement | Window = window;
    while (ancestor && ancestor !== document.body) {
      const overflowY = window.getComputedStyle(ancestor).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        ancestor.scrollHeight > ancestor.clientHeight
      ) {
        scrollContainer = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    checklistScrollTweenRef.current = gsap.to(scrollContainer, {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.7,
      ease: "power2.out",
      scrollTo: {
        y: target,
        offsetY: 96,
        autoKill: true,
      },
    });
  }

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

  const trackPicker = contest ? <fieldset className={contestSubmission ? "space-y-3" : ""}>
    <legend className="text-label-medium font-body">{t("projects.filters.tracks")} <span className="text-error-400">*</span></legend>
    <div className={contestSubmission ? "mt-3 grid gap-2" : "mt-3 flex flex-wrap gap-2"}>
      {(contest.tracks ?? [])
        .filter(option => option.active !== false || draft.tracks.includes(option.id))
        .map(option => {
          const checked = draft.tracks.includes(option.id);
          if (contestSubmission) {
            return <CheckboxCard
              key={option.id}
              size="small"
              orientation="horizontal"
              label={option.name}
              supportingText={option.description ?? undefined}
              className="gap-1 rounded-lg bg-project-track-card-surface p-3 [&_[data-slot=select-card-label]]:leading-[1.4] [&_[data-slot=select-card-supporting-text]]:text-body-medium [&_[data-slot=select-card-supporting-text]]:leading-[1.4] [&_[data-slot=select-card-supporting-text]]:tracking-[0.28px]"
              checked={checked}
              disabled={mutation.isPending || closed}
              onCheckedChange={() => change("tracks", checked ? draft.tracks.filter(id => id !== option.id) : [...draft.tracks, option.id])}
            />;
          }
          return <Checkbox
            key={option.id}
            size="small"
            label={option.name}
            checked={checked}
            disabled={mutation.isPending || closed}
            onCheckedChange={() => change("tracks", checked ? draft.tracks.filter(id => id !== option.id) : [...draft.tracks, option.id])}
            labelClassName={`min-h-11 rounded-lg border px-3 py-2 text-body-medium font-body ${mutation.isPending || closed ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${checked ? "border-primary bg-primary/5 text-primary" : "border-border bg-background"}`}
          />;
        })}
    </div>
  </fieldset> : null;
  const translationFields = <>
    <div role="group" aria-label={t("projects.translation.languages")} className="flex flex-wrap gap-2">
      {(["vi", "en"] as const).map(locale => <Button key={locale} type="button" variant="cta" hierarchy={(contentLocale === locale ? "primary" : "secondary")} aria-pressed={contentLocale === locale} onClick={() => setContentLocale(locale)}>{locale === "vi" ? "Tiếng Việt" : "English"}{draft.primaryLocale === locale ? ` · ${t("projects.translation.primary")}` : ""}</Button>)}
    </div>
    <p className="text-sm text-foreground-muted">{t("projects.translation.optional")}</p>
    {!isPrimary ? <Button type="button" variant="cta" hierarchy="secondary" onClick={() => { dismissRecovery(); setDraft(current => changePrimaryLocale(current, contentLocale)); }}>{t("projects.translation.makePrimary")}</Button> : null}
    <ProjectTranslationEditor projectId={projectId} draft={draft} disabled={closed || mutation.isPending} limits={contentLimits} onApply={(locale, translated) => { dismissRecovery(); setDraft(current => ({ ...current, locales: { ...current.locales, [locale]: translated } })); setContentLocale(locale); }} />
  </>;
  const pageHeader = <header className={contestSubmission ? "flex flex-wrap items-start justify-between gap-4" : "my-6 flex flex-wrap items-start justify-between gap-4"}>
    <div>
      {!contestSubmission ? <p className="text-label-small font-body uppercase tracking-widest text-primary">{t("projects.editor.workspace")}</p> : null}
      <h1 className={`${contestSubmission ? "" : "mt-2 "}text-heading-large font-display`}>
        {contestSubmission ? t("projects.editor.submissionTitle") : t(project ? "projects.form.editTitle" : "projects.form.createTitle")}
      </h1>
      <p className={`mt-2 max-w-2xl font-body ${contestSubmission ? "text-body-large text-catalog-subtitle" : "text-body-medium text-foreground-muted"}`}>
        {contestSubmission ? t("projects.editor.submissionHint") : t("projects.editor.intro")}
      </p>
    </div>
    {contest && project ? <NavLink to={`/hackathons/${contest.slug}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-base px-4 py-2 text-cta-medium font-body">
      <span className="truncate">{contest.title}</span><ExternalLink className="size-4 shrink-0" />
    </NavLink> : null}
  </header>;
  const storyFields = (["description", "progress"] as const).map(key => <ProjectMarkdownEditor
    key={key}
    label={t(contestSubmission ? `projects.editor.submission${key === "description" ? "Description" : "Progress"}` : `projects.editor.${key}`)}
    value={content[key]}
    onChange={value => changeContent(key, value)}
    maxLength={contentLimits[key]}
    required={isPrimary && key === "description" && publishing}
    hint={contestSubmission ? undefined : t(`projects.editor.${key}Hint`)}
    placeholder={contestSubmission ? t("projects.editor.submissionTextPlaceholder") : t(`projects.editor.${key}Placeholder`)}
    rows={contestSubmission ? 1 : key === "description" ? 10 : 6}
    variant={contestSubmission ? "plain" : "markdown"}
    layout="stacked"
    compactCounter={contestSubmission}
  />);

  return <div className={`container-app py-6 sm:py-8 ${contestSubmission ? "lg:py-12 lg:[--content-px:var(--corelia-spacing-8xl)]" : ""}`}>
    <BackLink to={back} className={`max-w-full${contestSubmission ? " mb-8" : ""}`}>
      {contestSubmission && contest ? (
        <span className="min-w-0 max-w-40 truncate">{contest.title}</span>
      ) : (
        t("projects.form.back")
      )}
    </BackLink>
    {!contestSubmission ? pageHeader : null}
    {closed ? <p role="status" className="mb-5 rounded-lg border border-border bg-surface-raised p-4 text-body-medium font-body">{t("projects.errors.deadline")}</p> : null}
    {recovered ? <p role="status" className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-body-medium font-body">{t("projects.editor.recovered")}</p> : null}
    <form onSubmit={event => { event.preventDefault(); if (complete && !closed && !uploading && !mutation.isPending) mutation.mutate(); }} className={`grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px] ${contestSubmission ? "lg:gap-x-12" : ""} [&_button:not(:disabled)]:cursor-pointer`}>
      <div className={`min-w-0 ${contestSubmission ? "space-y-8" : "space-y-6"}`}>
        {contestSubmission ? pageHeader : null}
        <fieldset disabled={mutation.isPending || closed} className={`min-w-0 ${contestSubmission ? "space-y-8" : "space-y-6"}`}>
          {!contestSubmission ? (
            <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
              <h2 className="text-lg font-semibold">{t("projects.translation.languages")}</h2>
              {translationFields}
            </section>
          ) : null}
          <section id="project-basics" className={`scroll-mt-24 ${contestSubmission ? "border-b border-border-subtle pb-8" : "rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"}`}>
            {!contestSubmission ? <><h2 className="text-heading-medium font-display">{t("projects.editor.basics")}</h2><p className="mt-1 text-body-medium font-body text-foreground-muted">{t("projects.editor.basicsHint")}</p></> : null}
            <div className={contestSubmission ? "grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12" : ""}>
              {contestSubmission ? <h2 className="text-heading-medium font-display text-project-editor-heading">{t("projects.editor.overview")}</h2> : null}
              <div className={contestSubmission ? "min-w-0 space-y-6" : "mt-6 space-y-5"}>
                <div className={contestSubmission ? "space-y-2" : ""}>
                  <label htmlFor="project-title" className={`block text-label-medium font-body${contestSubmission ? " leading-[1.4] tracking-[-0.07px] text-foreground-muted" : ""}`}>{t(contestSubmission ? "projects.editor.submissionProjectTitle" : "projects.form.title")} {isPrimary ? <span className="text-error-400">*</span> : null}</label>
                  <div>
                    <Input id="project-title" controlClassName={contestSubmission ? "" : undefined} className={contestSubmission ? "" : "mt-2"} required={isPrimary} maxLength={contentLimits.title} value={content.title} onChange={event => changeContent("title", event.target.value)} aria-describedby="project-title-hint" placeholder={t(contestSubmission ? "projects.editor.submissionTitlePlaceholder" : "projects.editor.titlePlaceholder")} />
                    <span id="project-title-hint" className="mt-2 block text-body-small text-foreground-muted">{t("projects.editor.titleHint")}</span>
                    {!contestSubmission ? <span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: content.title.length, limit: contentLimits.title })}</span> : null}
                  </div>
                </div>
                <div className={contestSubmission ? "space-y-2" : ""}>
                  <label htmlFor="project-slug" className={`block text-label-medium font-body${contestSubmission ? " leading-[1.4] tracking-[-0.07px] text-foreground-muted" : ""}`}>{t("projects.form.slug")} <span className="text-error-400">*</span></label>
                  <div>
                    <Input id="project-slug" controlClassName={contestSubmission ? "" : undefined} aria-describedby="project-slug-hint" className={contestSubmission ? "" : "mt-2"} required maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} placeholder={contestSubmission ? t("projects.editor.submissionSlugPlaceholder") : undefined} onChange={event => { setSlugTouched(true); change("slug", normalizeSlugDraft(event.target.value)); }} onBlur={() => { if (draft.slug.trim()) change("slug", slug); }} />
                    <span id="project-slug-hint" className="mt-2 block text-body-small text-foreground-muted">{t(contestSubmission ? "projects.editor.submissionSlugHint" : "projects.editor.slugHint")}</span>
                    {!contestSubmission ? <><span className="mt-1 block break-all text-body-small font-body text-foreground-muted">/projects/{slug || "…"}</span><span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: draft.slug.length, limit: 160 })}</span></> : null}
                  </div>
                </div>
                <div className={contestSubmission ? "space-y-1.5" : ""}>
                  <label htmlFor="project-summary" className={`block text-label-medium font-body${contestSubmission ? " leading-[1.4] tracking-[-0.07px] text-foreground-muted" : ""}`}>{t("projects.form.summary")}{publishing && isPrimary ? <span className="text-error-400"> *</span> : null}</label>
                  <div>
                    <Input id="project-summary" fieldType="auto-grow" submitOnEnter={false} rows={1} aria-describedby={contestSubmission ? "project-summary-hint project-summary-limit" : "project-summary-hint"} required={publishing && isPrimary} controlClassName={contestSubmission ? "h-[154px] min-h-[154px] max-h-[154px] overflow-hidden" : undefined} className={contestSubmission ? "h-full min-h-full max-h-full overflow-y-auto pb-5" : "min-h-[142px]"} maxLength={contentLimits.summary} value={content.summary} placeholder={contestSubmission ? t("projects.editor.submissionTextPlaceholder") : t("projects.editor.summaryPlaceholder")} onChange={event => changeContent("summary", event.target.value)} renderTrailingContent={contestSubmission ? () => <span id="project-summary-limit" className="pointer-events-none absolute bottom-2 right-3 text-body-small font-body text-foreground-muted">{t("projects.editor.submissionCharacterLimit", { count: content.summary.length, limit: contentLimits.summary })}</span> : undefined} />
                    {!contestSubmission ? <span id="project-summary-hint" className="mt-2 block text-body-small text-foreground-muted">{t("projects.editor.summaryHint")}</span> : <span id="project-summary-hint" className="sr-only">{t("projects.form.summary")}</span>}
                    {!contestSubmission ? <span className="mt-1 block text-right text-body-small font-body text-foreground-muted">{t("projects.editor.characterLimit", { count: content.summary.length, limit: contentLimits.summary })}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="project-story" className={`scroll-mt-24 ${contestSubmission ? "border-b border-border-subtle pb-8" : "rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"}`}>
            <div className={contestSubmission ? "grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12" : "space-y-5"}>
              {contestSubmission ? <h2 className="text-heading-medium font-display text-project-editor-heading">{t("projects.editor.submissionStory")}</h2> : null}
              <div className={contestSubmission ? "min-w-0 space-y-6" : ""}>
                {!contestSubmission ? <h2 className="mb-2 text-heading-medium font-display">{t("projects.editor.story")}</h2> : null}
                {storyFields}
              </div>
            </div>
          </section>
          <section id="project-media" className={`scroll-mt-24 ${contestSubmission ? "" : "rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"}`}>
            {!contestSubmission ? <h2 className="mb-5 text-heading-medium font-display">{t("projects.editor.media")}</h2> : null}
            <ProjectMediaEditor projectId={projectId} logo={draft.logo} screenshots={draft.screenshots} onLogoChange={logo => change("logo", logo)} onScreenshotsChange={screenshots => change("screenshots", screenshots)} deleteOnRemove={false} onRemovePath={path => setRemovedPaths(current => [...new Set([...current, path])])} onUploadingChange={setUploading} presentation={contestSubmission ? "submission" : "default"} />
          </section>
          {/* {contestSubmission ? <details className="rounded-xl border border-border-subtle bg-surface-base">
            <summary className="cursor-pointer px-5 py-4 text-label-medium font-body">{t("projects.translation.languages")}</summary>
            <div className="space-y-4 border-t border-border-subtle p-5">{translationFields}</div>
          </details> : null} */}
          <ProjectResourcesEditor draft={draft} onChange={change} presentation={contestSubmission ? "submission" : "default"} />
          {contest ? contestSubmission ? <section id="project-categories" className="scroll-mt-24">
            <Separator className="mb-6" />
            <div className="grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12">
              <div>
                <h2 className="text-heading-medium font-display text-project-editor-heading">{t("projects.editor.categories")}</h2>
                <p className="mt-4 text-body-small font-body text-foreground-subtle">{t("projects.editor.categoriesHint")}</p>
              </div>
              <div className="min-w-0 space-y-6">
                {trackPicker}
                <ProjectTaxonomyPicker presentation="submission" label={t("projects.filters.sectors")} options={sectorOptions} selectedIds={draft.sectors} customValues={draft.customSectors} searchPlaceholder={t("projects.editor.taxonomySearch")} addLabel={(value) => t("projects.editor.taxonomyAdd", { value })} limitLabel={t("projects.editor.taxonomyLimit")} onChange={(ids, custom) => setDraft(current => ({ ...current, sectors: ids, customSectors: custom }))} />
                <ProjectTaxonomyPicker presentation="submission" label={t("projects.filters.techStacks")} options={techOptions} selectedIds={draft.tech} customValues={draft.customTech} searchPlaceholder={t("projects.editor.taxonomySearch")} addLabel={(value) => t("projects.editor.taxonomyAdd", { value })} limitLabel={t("projects.editor.taxonomyLimit")} onChange={(ids, custom) => setDraft(current => ({ ...current, tech: ids, customTech: custom }))} />
                {taxonomyQuery.isError ? <p role="alert" className="text-sm text-destructive">{t("projects.editor.taxonomyLoadError")}</p> : null}
              </div>
            </div>
          </section> : <section id="project-categories" className="scroll-mt-24 space-y-6 rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
            <div><h2 className="text-heading-medium font-display">{t("projects.editor.categories")}</h2><p className="mt-1 text-body-medium font-body text-foreground-muted">{t("projects.editor.categoriesHint")}</p></div>
            {trackPicker}
            <ProjectTaxonomyPicker label={t("projects.filters.sectors")} options={sectorOptions} selectedIds={draft.sectors} customValues={draft.customSectors} searchPlaceholder={t("projects.editor.taxonomySearch")} addLabel={(value) => t("projects.editor.taxonomyAdd", { value })} limitLabel={t("projects.editor.taxonomyLimit")} onChange={(ids, custom) => setDraft(current => ({ ...current, sectors: ids, customSectors: custom }))} />
            <ProjectTaxonomyPicker label={t("projects.filters.techStacks")} options={techOptions} selectedIds={draft.tech} customValues={draft.customTech} searchPlaceholder={t("projects.editor.taxonomySearch")} addLabel={(value) => t("projects.editor.taxonomyAdd", { value })} limitLabel={t("projects.editor.taxonomyLimit")} onChange={(ids, custom) => setDraft(current => ({ ...current, tech: ids, customTech: custom }))} />
            {taxonomyQuery.isError ? <p role="alert" className="text-sm text-destructive">{t("projects.editor.taxonomyLoadError")}</p> : null}
          </section> : null}
        </fieldset>
        <section id="project-team" className={`scroll-mt-24 ${contestSubmission ? "" : "rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"}`}>
          {contestSubmission ? <>
            <Separator className="mb-6" />
            <div className="grid min-w-0 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12">
              <div>
                <h2 className="text-heading-medium font-display text-project-editor-heading">{t("projects.team.title")}</h2>
                <p className="mt-4 text-body-small font-body text-foreground-subtle">{t("projects.team.hint")}</p>
                <p className="mt-2 text-body-small font-body text-foreground-subtle">{t("projects.team.limit", { count: MAX_PROJECT_TEAM_SIZE })}</p>
                {contest ? <p className="mt-2 text-body-small font-body text-foreground-subtle">{t(isPastContestSubmissionDeadline(contest) && canEditContestProject(contest) ? "projects.team.lateMembersHint" : "projects.team.hackathonEligibleHint")}</p> : null}
              </div>
              <ProjectTeamEditor presentation="submission" ownerId={project?.owner_id} editsClosed={closed} lateMembersAllowed={Boolean(contest && isPastContestSubmissionDeadline(contest) && canEditContestProject(contest))} projectId={projectId} sourceType={project?.source_type ?? (contest ? "hackathon" : "standalone")} sourceId={project?.source_id ?? contest?.id} persisted={Boolean(project)} selectedIds={teamIds} onSelectedIdsChange={setTeamIds} />
            </div>
          </> : <><h2 className="mb-5 text-heading-medium font-display">{t("projects.editor.team")}</h2><ProjectTeamEditor ownerId={project?.owner_id} editsClosed={closed} lateMembersAllowed={Boolean(contest && isPastContestSubmissionDeadline(contest) && canEditContestProject(contest))} projectId={projectId} sourceType={project?.source_type ?? (contest ? "hackathon" : "standalone")} sourceId={project?.source_id ?? contest?.id} persisted={Boolean(project)} selectedIds={teamIds} onSelectedIdsChange={setTeamIds} /></>}
        </section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-24">
        <div className={`rounded-2xl border bg-surface-base ${contestSubmission ? "border-border px-4 pt-3 pb-4 shadow-card" : "border-border-subtle p-5"}`}>
          <h2 className={contestSubmission ? "text-base font-medium leading-6 tracking-[-0.32px] text-foreground" : "text-heading-medium font-display"}>
            {contestSubmission
              ? t("projects.editor.requiredInformation")
              : `${t("projects.editor.checklist")} (${draft.primaryLocale.toUpperCase()})`}
          </h2>
          {contestSubmission ? <div className="mt-2 h-px w-full bg-border" /> : null}
          {!contestSubmission ? <p className="mt-2 text-body-small text-foreground-muted">{t("projects.editor.checklistHint")}</p> : null}
          <ul className={contestSubmission ? "mt-2.5 space-y-0" : "mt-4 space-y-3"}>
            {checklistItems.map(item => (
              <li key={item.label}>
                {contestSubmission ? (
                  <Action
                    nativeButton={false}
                    render={
                      <a
                        href={item.href}
                        onClick={event => handleChecklistScroll(event, item.href)}
                      />
                    }
                    label={
                      <span className="group-hover/action:text-foreground">
                        {item.label}
                      </span>
                    }
                    trailingGroup={
                      <ProgressCircle
                        aria-label={t(item.done ? "projects.editor.complete" : "projects.editor.missing")}
                        className="mt-0.5 size-5"
                        colorVariant={item.done ? "90" : "70"}
                        done={item.done}
                        percentage={
                          "percentage" in item && typeof item.percentage === "number"
                            ? item.percentage
                            : 0
                        }
                        process={
                          "percentage" in item &&
                          typeof item.percentage === "number" &&
                          item.percentage < 100
                        }
                        colored={
                          "percentage" in item &&
                          typeof item.percentage === "number" &&
                          item.percentage > 0 &&
                          item.percentage < 100
                        }
                      />
                    }
                    size="small"
                    isActive={false}
                    showActive={false}
                    className="cursor-pointer hover:bg-transparent data-[active=true]:bg-transparent"
                  />
                ) : (
                  <a href={item.href} className="flex items-center gap-2 text-body-medium font-body">
                    {item.done ? <Check className="size-4 text-primary" /> : <Circle className="size-4 text-foreground-subtle" />}
                    <span>{item.label}</span>
                    <span className="sr-only">{t(item.done ? "projects.editor.complete" : "projects.editor.missing")}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {contest && !contestSubmission ? <p className="mt-5 text-body-small font-body text-foreground-muted">{t("projects.editor.publicHint")}</p> : !contest ? <label className="mt-5 block text-label-medium font-body">{t("projects.form.visibility")}<select value={draft.visibility} onChange={event => change("visibility", event.target.value as ProjectDraft['visibility'])} disabled={mutation.isPending} className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3">{(['public', 'unlisted', 'private'] as const).map(value => <option key={value} value={value}>{t(`projects.editor.${value}`)}</option>)}</select></label> : null}
          {!withinLimits ? <p role="alert" className="mt-4 text-body-small font-body text-destructive">{t("projects.editor.limitHint")}</p> : null}
          {!contestSubmission && !complete && withinLimits ? <p className="mt-4 text-body-small font-body text-foreground-muted">{t("projects.editor.requiredHint")}</p> : null}
          <Button className={`${contestSubmission ? "mt-2.5" : "mt-5"} w-full`} size={contestSubmission ? "small" : "medium"} type="submit" disabled={mutation.isPending || uploading || closed || !complete}>{mutation.isPending || uploading ? <LoaderCircle className="size-4 animate-spin" /> : null}{t(uploading ? "projects.editor.uploading" : mutation.isPending ? "projects.form.saving" : contestSubmission || project ? "projects.form.save" : "projects.form.create")}</Button>
          {contestSubmission ? <p className="mt-2.5 text-sm leading-[1.25] tracking-[0.28px] font-body italic text-foreground-subtle">{t("projects.editor.submissionSaveHint")}</p> : null}
          {(!contestSubmission || dirty) ? <p className="mt-3 text-body-small font-body text-foreground-muted" role="status">{t(dirty ? "projects.editor.unsaved" : "projects.editor.ready")}</p> : null}
        </div>
        {mutation.isError ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-body-medium font-body text-destructive">{projectErrorMessage(mutation.error, t)}<p className="mt-2">{t("projects.editor.retryHint")}</p></div> : null}
      </aside>
    </form>
  </div>;
}
