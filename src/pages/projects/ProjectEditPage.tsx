import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectMediaEditor, type ProjectMediaItem } from "@/features/projects/ProjectMediaEditor";
import { publicProjectDetailQueryOptions } from "@/features/projects/projectQueries";
import { ProjectTeamEditor } from "@/features/projects/ProjectTeamEditor";
import { getContest } from "@/lib/hackathons";
import { generateCanonicalProjectSlug } from "@/lib/hackathonContract";
import { updateMyProject } from "@/lib/projects";
import { isHackathonProjectSource } from "@/lib/projectSource";
import { canonicalizeSlug, normalizeSlugDraft } from "@/lib/slug";
import { deleteProjectMedia } from "@/lib/projectSubmission";
import { formatProjectError } from "@/lib/projectErrors";
import { useAuth } from "@/stores/authStore";

type Draft = {
  slug: string;
  title: string;
  summary: string;
  demo: string;
  repo: string;
  slide: string;
  video: string;
  logo: ProjectMediaItem | null;
  screenshots: ProjectMediaItem[];
  visibility: "public" | "unlisted" | "private";
  tracks: string[];
  sectors: string[];
  tech: string[];
};

const EMPTY_DRAFT: Draft = { slug: "", title: "", summary: "", demo: "", repo: "", slide: "", video: "", logo: null, screenshots: [], visibility: "public", tracks: [], sectors: [], tech: [] };

export default function ProjectEditPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation("common");
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const projectQuery = useQuery(publicProjectDetailQueryOptions(slug, locale));
  const project = projectQuery.data?.project ?? null;
  const contestQuery = useQuery({ queryKey: ["hackathons", project?.source_id, "project-edit", locale], queryFn: () => getContest(project!.source_id!, locale), enabled: Boolean(project?.source_id && isHackathonProjectSource(project.source_type)) });
  const [draftState, setDraftState] = useState<Draft | null>(null);
  const [removedMediaPaths, setRemovedMediaPaths] = useState<string[]>([]);
  const uploadedPathsRef = useRef<string[]>([]);
  const savedRef = useRef(false);
  const loadedDraft = useMemo<Draft | null>(() => project ? {
    slug: project.slug,
    title: project.title,
    summary: project.summary ?? "",
    demo: project.demo_url ?? "",
    repo: project.repo_url ?? "",
    slide: project.slide_url ?? "",
    video: project.video_url ?? "",
    logo: project.logo_path && project.logo_url ? { path: project.logo_path, url: project.logo_url } : null,
    screenshots: (project.screenshot_paths ?? []).map((path, index) => ({ path, url: project.screenshot_urls?.[index] ?? "" })).filter((item) => item.url),
    visibility: project.visibility,
    tracks: project.hackathon_track_ids ?? [],
    sectors: project.hackathon_sector_ids ?? [],
    tech: project.hackathon_tech_stack_ids ?? [],
  } : null, [project]);
  const draft = draftState ?? loadedDraft ?? EMPTY_DRAFT;
  const effectiveSlug = draft.slug.trim() ? generateCanonicalProjectSlug(draft.slug) : "";
  const setDraft = (next: Draft | ((current: Draft) => Draft)) => setDraftState((current) => { const base = current ?? loadedDraft ?? EMPTY_DRAFT; return typeof next === "function" ? next(base) : next; });
  const canEdit = Boolean(project && (project.owner_id === user?.id || profile?.role === "admin" || profile?.role === "support_staff"));
  const currentProjectId = project?.id ?? null;
  useEffect(() => () => {
    if (savedRef.current || !currentProjectId) return;
    for (const path of uploadedPathsRef.current) {
      void deleteProjectMedia(currentProjectId, path).catch(() => undefined);
    }
  }, [currentProjectId]);

  async function clearUnsavedUploads() {
    if (!project) return;
    const paths = uploadedPathsRef.current;
    await Promise.allSettled(paths.map((path) => deleteProjectMedia(project.id, path)));
    uploadedPathsRef.current = [];
    setRemovedMediaPaths([]);
    setDraftState(null);
  }
  const mutation = useMutation({
    mutationFn: () => updateMyProject(project!.id, {
      slug: effectiveSlug,
      title: draft.title,
      summary: draft.summary,
      demo_url: draft.demo,
      repo_url: draft.repo,
      slide_url: draft.slide,
      video_url: draft.video,
      logo_path: draft.logo?.path ?? null,
      screenshot_paths: draft.screenshots.map((item) => item.path),
      visibility: draft.visibility,
      hackathon_track_ids: draft.tracks,
      hackathon_sector_ids: draft.sectors,
      hackathon_tech_stack_ids: draft.tech,
      removed_media_paths: removedMediaPaths,
    }),
    onSuccess: async () => {
      savedRef.current = true;
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("projects.form.saved"));
      navigate(`/projects/${effectiveSlug}`);
    },
    onError: async (error) => {
      await clearUnsavedUploads();
      toast.error(formatProjectError(error, t));
    },
  });
  const toggle = (key: "tracks" | "sectors" | "tech", id: string) => setDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));

  if (projectQuery.isPending) return <div className="container-app py-16 text-center text-sm text-foreground-muted">{t("projects.loading")}</div>;
  if (!project || !canEdit) return <div className="container-app py-16 text-center"><h1 className="font-semibold">{t("projects.form.cannotEdit")}</h1><Button className="mt-4" render={<NavLink to="/projects" />} nativeButton={false}>{t("projects.detail.goBack")}</Button></div>;
  const contest = contestQuery.data;
  const groups = contest ? [{ key: "tracks" as const, label: t("projects.filters.tracks"), options: contest.tracks ?? [] }, { key: "sectors" as const, label: t("projects.filters.sectors"), options: contest.sectors ?? [] }, { key: "tech" as const, label: t("projects.filters.techStacks"), options: contest.tech_stacks ?? [] }] : [];

  return (
    <div className="container-app max-w-4xl py-6 sm:py-8">
      <Button variant="ghost" render={<NavLink to={`/projects/${project.slug}`} />} nativeButton={false}><ArrowLeft className="size-4" />{t("projects.form.back")}</Button>
      <h1 className="mt-4 text-2xl font-semibold">{t("projects.form.editTitle")}</h1>
      <form className="mt-6 space-y-6 rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card sm:p-7" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("projects.form.title")} <span className="text-primary">*</span><Input className="mt-2" required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="text-sm font-medium">{t("projects.form.slug")} <span className="text-primary">*</span><Input className="mt-2" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: normalizeSlugDraft(event.target.value) })} onBlur={() => setDraft((current) => ({ ...current, slug: canonicalizeSlug(current.slug) }))} /></label></div>
        <label className="block text-sm font-medium">{t("projects.form.summary")}<textarea className="mt-2 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2" rows={5} maxLength={1000} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">{t("projects.form.demoUrl")}<Input className="mt-2" type="url" value={draft.demo} onChange={(event) => setDraft({ ...draft, demo: event.target.value })} /></label>
          <label className="text-sm font-medium">{t("projects.form.repoUrl")}<Input className="mt-2" type="url" value={draft.repo} onChange={(event) => setDraft({ ...draft, repo: event.target.value })} /></label>
          <label className="text-sm font-medium">{t("projects.form.slideUrl")}<Input className="mt-2" type="url" value={draft.slide} onChange={(event) => setDraft({ ...draft, slide: event.target.value })} /></label>
          <label className="text-sm font-medium">{t("projects.form.videoUrl")}<Input className="mt-2" type="url" value={draft.video} onChange={(event) => setDraft({ ...draft, video: event.target.value })} /></label>
        </div>
        <ProjectMediaEditor projectId={project.id} logo={draft.logo} screenshots={draft.screenshots} onLogoChange={(logo) => setDraft({ ...draft, logo })} onScreenshotsChange={(screenshots) => setDraft({ ...draft, screenshots })} deleteOnRemove={false} onRemovePath={(path) => setRemovedMediaPaths((current) => current.includes(path) ? current : [...current, path])} onUploadPath={(path) => { if (!uploadedPathsRef.current.includes(path)) uploadedPathsRef.current.push(path); }} />
        <ProjectTeamEditor projectId={project.id} sourceType={project.source_type} sourceId={project.source_id} persisted />
        <label className="block text-sm font-medium">{t("projects.form.visibility")}<select className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3" value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Draft["visibility"] })} disabled={isHackathonProjectSource(project.source_type)}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label>
        {groups.map((group) => <fieldset key={group.key}><legend className="text-sm font-medium">{group.label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.options.filter((option) => option.active !== false).map((option) => <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm"><input type="checkbox" checked={draft[group.key].includes(option.id)} onChange={() => toggle(group.key, option.id)} />{option.name}</label>)}</div></fieldset>)}
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending || !draft.title.trim() || !effectiveSlug || (Boolean(contest) && (!draft.tracks.length || !draft.sectors.length || !draft.tech.length))}>{mutation.isPending ? t("projects.form.saving") : t("projects.form.save")}</Button></div>
      </form>
    </div>
  );
}
