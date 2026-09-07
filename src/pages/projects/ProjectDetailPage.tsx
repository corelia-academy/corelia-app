import { Tabs } from "@base-ui/react/tabs";
import { toast } from "sonner";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Share2,
  Users,
  ExternalLink,
  Github,
  ImageIcon,
  Package,
  PlayCircle,
  Presentation,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/markdown/Markdown";
import { ProjectManagementControls } from "@/components/projects/ProjectManagementControls";
import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectCoverImageUrl, type PublicProjectEntry } from "@/lib/projects";
import { listPublicProjectTeam } from "@/lib/projectCollaboration";
import { projectVideoEmbed } from "@/lib/projectVideo";
import { publicProjectDetailQueryOptions } from "@/features/projects/projectQueries";
import { getContest } from "@/lib/hackathons";
import { isHackathonProjectSource, projectSourceLabelKey } from "@/lib/projectSource";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

function sourceLink(project: Project, hackathonSlug?: string | null): string | null {
  if (isHackathonProjectSource(project.source_type) && project.source_id) {
    return `/hackathons/${hackathonSlug || project.source_id}`;
  }
  if (project.source_type === "course" && project.source_id) {
    return `/courses/${project.source_id}`;
  }
  return null;
}

function ownerDisplay(owner: PublicProjectEntry["owner"]): {
  label: string | null;
  handle: string | null;
} {
  const handle = owner?.username || owner?.ocid || owner?.id || null;
  const label = owner?.full_name?.trim() || owner?.username?.trim() || owner?.ocid?.trim() || null;
  return { label, handle };
}

function ProjectLogo({ project }: { project: Project }) {
  const coverUrl = getProjectCoverImageUrl(project);
  if (coverUrl) {
    return (
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
        <img src={coverUrl} alt={project.title} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised text-foreground-subtle">
      <ImageIcon className="size-10" aria-hidden />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-app py-6 sm:py-8">
      <Skeleton className="mb-4 h-8 w-40" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const query = useQuery(publicProjectDetailQueryOptions(slug, locale));
  const entry = query.data;
  const sourceQuery = useQuery({
    queryKey: ["hackathons", "source", entry?.project.source_id ?? "missing", locale],
    queryFn: () => getContest(entry!.project.source_id!, locale),
    enabled: Boolean(entry?.project.source_id && isHackathonProjectSource(entry.project.source_type)),
    staleTime: 60_000,
  });
  const teamQuery = useQuery({
    queryKey: ["projects", entry?.project.id ?? "missing", "public-team"],
    queryFn: () => listPublicProjectTeam(entry!.project.id),
    enabled: Boolean(entry?.project.id),
    staleTime: 60_000,
  });
  const loading = query.isPending;
  const notFound = !slug || (query.isSuccess && entry === null);
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : t("projects.errorDescription")
    : null;

  const owner = useMemo(() => ownerDisplay(entry?.owner ?? null), [entry?.owner]);
  const projectId = entry?.project.id;
  const winnerAward = useMemo(() => {
    const awards = sourceQuery.data?.winner_awards ?? [];
    return awards.find((item) => item.project_id === projectId) ?? null;
  }, [sourceQuery.data?.winner_awards, projectId]);

  useEffect(() => {
    if (entry?.project.slug && slug !== entry.project.slug) {
      navigate(`/projects/${entry.project.slug}`, { replace: true });
    }
  }, [entry?.project.slug, navigate, slug]);

  if (notFound) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <Package className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div className="max-w-md">
            <h1 className="text-lg font-semibold text-foreground">
              {t("projects.detail.notFoundTitle")}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("projects.detail.notFoundDescription")}
            </p>
          </div>
          <Button render={<NavLink to="/projects" />} nativeButton={false}>
            {t("projects.detail.goBack")}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) return <DetailSkeleton />;

  if (error || !entry) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <ShieldAlert className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div className="max-w-md">
            <h1 className="text-lg font-semibold text-foreground">{t("projects.errorTitle")}</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {error || t("projects.errorDescription")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => void query.refetch()}>
              {t("projects.retry")}
            </Button>
            <Button variant="outline" render={<NavLink to="/projects" />} nativeButton={false}>
              {t("projects.detail.goBack")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { project } = entry;
  const href = sourceLink(project, sourceQuery.data?.slug);
  const canEdit = user?.id === project.owner_id || profile?.role === "admin" || profile?.role === "support_staff";
  const description = project.description || project.summary || t("projects.detail.noDescription");
  const videoEmbed = projectVideoEmbed(project.video_url);
  const pitchEmbed = projectVideoEmbed(project.pitch_video_url);

  const actions = [
    href
      ? {
          key: "source",
          label: t("projects.detail.viewSource"),
          href,
          external: false,
          icon: ExternalLink,
        }
      : null,
    project.demo_url
      ? {
          key: "demo",
          label: t("projects.detail.demo"),
          href: project.demo_url,
          external: true,
          icon: ExternalLink,
        }
      : null,
    project.repo_url
      ? {
          key: "repo",
          label: t("projects.detail.repo"),
          href: project.repo_url,
          external: true,
          icon: Github,
        }
      : null,
    project.slide_url
      ? {
          key: "slides",
          label: t("projects.detail.slides"),
          href: project.slide_url,
          external: true,
          icon: Presentation,
        }
      : null,
    project.pitch_video_url ? { key: "pitch", label: t("projects.editor.pitchVideo"), href: project.pitch_video_url, external: true, icon: PlayCircle } : null,
    project.video_url
      ? {
          key: "video",
          label: t("projects.detail.video"),
          href: project.video_url,
          external: true,
          icon: PlayCircle,
        }
      : null,
  ].filter(Boolean);

  const taxonomy = [
    { label: t("projects.filters.tracks"), options: sourceQuery.data?.tracks, selected: project.hackathon_track_ids },
    { label: t("projects.filters.sectors"), options: sourceQuery.data?.sectors, selected: project.hackathon_sector_ids },
    { label: t("projects.filters.techStacks"), options: sourceQuery.data?.tech_stacks, selected: project.hackathon_tech_stack_ids },
  ].map(group => ({ ...group, values: group.options?.filter(option => group.selected?.includes(option.id)) ?? [] }));
  const resourceActions = actions.filter(action => action && action.key !== "source");
  const teamMembers = teamQuery.data?.filter(member => member.user_id !== project.owner_id) ?? [];
  const ownerLink = owner.handle ? `/@${owner.handle}` : null;
  const back = sourceQuery.data?.slug ? `/hackathons/${sourceQuery.data.slug}/projects` : "/projects";

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" render={<NavLink to={back} />} nativeButton={false}>
          <ArrowLeft className="size-4" />
          {t("projects.detail.backToProjects")}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectManagementControls project={project} onDeleted={() => navigate("/projects", { replace: true })} />
          <ProjectSocialBlock projectId={project.id} likeCount={Number(project.like_count ?? 0)} className="border-0 pt-0" />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/projects/${project.slug}`);
                toast.success(t("projects.editor.copied"));
              } catch {
                toast.error(t("projects.editor.copyFailed"));
              }
            }}
          >
            <Share2 className="size-4" />
            {t("projects.editor.share")}
          </Button>
          {canEdit ? (
            <Button size="sm" render={<NavLink to={`/projects/${project.slug}/edit`} />} nativeButton={false}>
              {t("projects.detail.edit")}
            </Button>
          ) : null}
        </div>
      </div>
      {project.blocked ? (
        <p role="status" className="mb-4 rounded-lg border border-destructive p-3 text-sm text-destructive">
          {t("projects.management.blockedError")}
        </p>
      ) : null}
      <header className="flex flex-col gap-5 border-b border-border-subtle pb-8 sm:flex-row sm:items-start">
        <ProjectLogo project={project} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              {t(projectSourceLabelKey(project.source_type))}
            </span>
            {winnerAward ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950 shadow">
                <Sparkles className="size-3" aria-hidden />
                {winnerAward.label}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{project.title}</h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-foreground-muted">
            {project.summary || t("projects.card.noSummary")}
          </p>
        </div>
      </header>
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Tabs.Root defaultValue="overview" className="min-w-0">
        <Tabs.List className="mb-6 flex gap-6 overflow-x-auto border-b border-border-subtle" aria-label={t("projects.editor.sections")}>
          {(["overview","resources","team"] as const).map(value => <Tabs.Tab key={value} value={value} className="min-h-12 shrink-0 border-b-2 border-transparent px-1 text-sm font-medium text-foreground-muted data-[active]:border-primary data-[active]:text-primary">{t(value === "team" ? "projects.team.publicTitle" : `projects.editor.${value}`)}</Tabs.Tab>)}
        </Tabs.List>
        <Tabs.Panel value="overview" className="space-y-6">
          {videoEmbed || pitchEmbed ? <Tabs.Root defaultValue={videoEmbed ? "demo" : "pitch"} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base"><Tabs.List className="flex gap-4 border-b border-border-subtle p-3" aria-label={t("projects.editor.videos")}>{videoEmbed ? <Tabs.Tab value="demo" className="rounded-lg px-3 py-2 text-sm data-[active]:bg-primary/10 data-[active]:text-primary">{t("projects.detail.video")}</Tabs.Tab> : null}{pitchEmbed ? <Tabs.Tab value="pitch" className="rounded-lg px-3 py-2 text-sm data-[active]:bg-primary/10 data-[active]:text-primary">{t("projects.editor.pitchVideo")}</Tabs.Tab> : null}</Tabs.List>{[["demo",videoEmbed],["pitch",pitchEmbed]].map(([value,embed])=> typeof value === 'string' && embed && typeof embed !== 'string' ? <Tabs.Panel key={value} value={value}><iframe className="aspect-video w-full" src={embed.src} title={value === 'demo' ? t("projects.detail.video") : t("projects.editor.pitchVideo")} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></Tabs.Panel> : null)}</Tabs.Root> : null}
          {(project.screenshot_urls?.length ?? 0) > 0 ? <section><h2 className="mb-3 text-lg font-semibold">{t("projects.form.screenshots")}</h2><div className="grid gap-3 sm:grid-cols-2">{project.screenshot_urls?.map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border-subtle"><img src={url} alt={t("projects.form.screenshotAlt",{index:index+1})} className="aspect-video w-full object-cover" loading="lazy" /></a>)}</div></section> : null}
          <section className="rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="text-lg font-semibold">{t("projects.detail.description")}</h2><div className="mt-4 break-words"><Markdown content={description} /></div></section>
          {project.progress ? <section className="rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="text-lg font-semibold">{t("projects.editor.progress")}</h2><div className="mt-4 break-words"><Markdown content={project.progress} /></div></section> : null}
          {href && sourceQuery.data ? <NavLink to={href} className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-base p-5 hover:border-primary/40 sm:flex-row">{sourceQuery.data.cover_image_url ? <img src={sourceQuery.data.cover_image_url} alt="" className="h-24 w-full rounded-lg object-cover sm:w-36" /> : null}<div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{t("projects.editor.hackathon")}</p><h2 className="mt-2 font-semibold">{sourceQuery.data.title}</h2><p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{sourceQuery.data.short_description || sourceQuery.data.tagline}</p></div></NavLink> : null}
        </Tabs.Panel>
        <Tabs.Panel value="resources" className="rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="text-lg font-semibold">{t("projects.editor.links")}</h2><div className="mt-5 space-y-3">{resourceActions.length ? resourceActions.map(action => action ? <a key={action.key} href={action.href} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-4 hover:bg-surface-raised"><action.icon className="size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-sm font-semibold">{action.label}</span><span className="mt-1 block truncate text-xs text-foreground-muted">{action.href}</span></span><ExternalLink className="ml-auto size-4 shrink-0" /></a> : null) : <p className="text-sm text-foreground-muted">{t("projects.editor.noResources")}</p>}</div></Tabs.Panel>
        <Tabs.Panel value="team" className="rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7"><h2 className="text-lg font-semibold">{t("projects.team.publicTitle")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("projects.editor.aboutTeam")}</p><div className="mt-5 flex items-center gap-3 rounded-xl border border-border p-4"><Users className="size-6 text-primary" /><div><p className="text-xs text-foreground-muted">{t("projects.editor.teamLeader")}</p>{ownerLink ? <NavLink to={ownerLink} className="mt-1 block text-sm font-semibold hover:underline">{owner.label || owner.handle}</NavLink> : <p>{owner.label}</p>}</div></div>
          {teamQuery.isPending ? <p className="mt-4 text-sm" role="status">{t("projects.team.loading")}</p> : teamQuery.isError ? <Button className="mt-4" variant="outline" onClick={() => void teamQuery.refetch()}>{t("projects.retry")}</Button> : teamMembers.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{teamMembers.map(member => { const label = member.full_name?.trim() || member.username?.trim() || t("projects.editor.builder"); const content = <>{member.avatar_url ? <img src={member.avatar_url} alt="" className="size-10 rounded-full object-cover" /> : <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised">{label[0]}</span>}<span className="min-w-0 truncate">{label}</span></>; return member.username ? <NavLink key={member.user_id} to={`/@${member.username}`} className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm hover:bg-surface-raised">{content}</NavLink> : <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm">{content}</div>; })}</div> : <p className="mt-4 text-sm text-foreground-muted">{t("projects.editor.noTeam")}</p>}
        </Tabs.Panel>
      </Tabs.Root>
      <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
        <section className="rounded-2xl border border-border-subtle bg-surface-base p-5"><p className="text-xs text-foreground-muted">{t("projects.editor.teamLeader")}</p>{ownerLink ? <NavLink className="mt-2 block truncate font-semibold hover:text-primary" to={ownerLink}>{owner.label || owner.handle}</NavLink> : <p className="mt-2 truncate font-semibold">{owner.label}</p>}
          {resourceActions.length ? <div className="mt-5 flex flex-wrap gap-2">{resourceActions.map(action => action ? <Button key={action.key} variant="outline" size="sm" render={<a href={action.href} target="_blank" rel="noreferrer" />} nativeButton={false}><action.icon className="size-4" />{action.label}</Button> : null)}</div> : null}
          <div className="mt-5 border-t border-border-subtle pt-4"><p className="text-xs text-foreground-muted">{t("projects.editor.updated")}</p><time className="mt-1 block text-sm" dateTime={project.updated_at}>{new Intl.DateTimeFormat(locale,{dateStyle:"medium"}).format(new Date(project.updated_at))}</time></div>
        </section>
        {taxonomy.some(group=>group.values.length) ? <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface-base p-5">{taxonomy.filter(group=>group.values.length).map(group=><div key={group.label}><h2 className="text-xs font-semibold text-foreground-muted">{group.label}</h2><div className="mt-2 flex flex-wrap gap-2">{group.values.map(option=><span key={option.id} className="rounded-full bg-surface-raised px-3 py-1.5 text-xs">{option.name}</span>)}</div></div>)}</section> : null}
        {href ? <Button className="w-full" variant="outline" render={<NavLink to={href} />} nativeButton={false}>{sourceQuery.data?.title || t("projects.detail.viewSource")}<ExternalLink className="size-4" /></Button> : null}
      </aside>
    </div>
  </div>;
}
