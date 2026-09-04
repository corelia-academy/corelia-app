import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
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
    return `/hackathons/${hackathonSlug || project.source_id}/overview`;
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
        <img src={coverUrl} alt={project.title} className="h-full w-full object-contain p-2" />
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
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
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
  const description = project.summary || t("projects.detail.noDescription");
  const videoEmbed = projectVideoEmbed(project.video_url);

  const winnerAward = useMemo(() => {
    const awards = sourceQuery.data?.winner_awards ?? [];
    return awards.find((item) => item.project_id === project?.id) ?? null;
  }, [sourceQuery.data?.winner_awards, project?.id]);

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
    project.video_url && !videoEmbed
      ? {
          key: "video",
          label: t("projects.detail.video"),
          href: project.video_url,
          external: true,
          icon: PlayCircle,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="container-app py-6 sm:py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1"
        render={<NavLink to="/projects" />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("projects.detail.backToProjects")}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <main className="min-w-0">
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-4">
              <ProjectLogo project={project} />
              <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {project.title}
              </h1>
              {winnerAward ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950 shadow">
                  <Sparkles className="size-3" aria-hidden />
                  {winnerAward.label}
                </span>
              ) : null}
              <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                {t(projectSourceLabelKey(project.source_type))}
              </span>
            </div>

            {owner.label || owner.handle ? (
              <p className="mt-2 text-sm text-foreground-muted">
                {t("projects.byPrefix")}{" "}
                {owner.handle ? (
                  <NavLink
                    className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    to={`/@${owner.handle}`}
                  >
                    @{owner.handle}
                  </NavLink>
                ) : (
                  <span className="font-medium text-foreground">{owner.label}</span>
                )}
              </p>
            ) : null}
              </div>
            </div>

            {actions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((action) => {
                  if (!action) return null;
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.key}
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      render={
                        action.external ? (
                          <a href={action.href} target="_blank" rel="noreferrer" />
                        ) : (
                          <NavLink to={action.href} />
                        )
                      }
                      nativeButton={false}
                    >
                      <Icon className="size-4" aria-hidden />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}

            {canEdit ? (
              <Button className="mt-4" render={<NavLink to={`/projects/${project.slug}/edit`} />} nativeButton={false}>
                {t("projects.detail.edit")}
              </Button>
            ) : null}

            {videoEmbed ? (
              <section className="mt-6">
                <h2 className="text-base font-semibold text-foreground">{t("projects.detail.video")}</h2>
                <iframe
                  className="mt-3 aspect-video w-full rounded-lg border border-border-subtle"
                  src={videoEmbed.src}
                  title={t("projects.detail.video")}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </section>
            ) : null}

            {(project.screenshot_urls?.length ?? 0) > 0 ? (
              <section className="mt-6">
                <h2 className="text-base font-semibold text-foreground">{t("projects.form.screenshots")}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {project.screenshot_urls?.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-border-subtle">
                      <img src={url} alt={t("projects.form.screenshotAlt", { index: index + 1 })} className="aspect-video w-full object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {(teamQuery.data?.length ?? 0) > 0 ? (
              <section className="mt-6">
                <h2 className="text-base font-semibold text-foreground">{t("projects.team.publicTitle")}</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {teamQuery.data?.map((member) => {
                    const label = member.full_name?.trim() || member.username?.trim() || member.user_id;
                    const content = <>
                        {member.avatar_url ? <img src={member.avatar_url} alt="" className="size-7 rounded-full object-cover" /> : <span className="flex size-7 items-center justify-center rounded-full bg-surface-raised text-xs">{label.slice(0, 1).toUpperCase()}</span>}
                        <span>{label}</span>
                      </>;
                    return member.username ? (
                      <NavLink key={member.user_id} to={`/@${member.username}`} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm hover:bg-surface-raised">{content}</NavLink>
                    ) : (
                      <span key={member.user_id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">{content}</span>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <h2 className="text-base font-semibold text-foreground">
                {t("projects.detail.description")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground-muted">
                {description}
              </p>
            </section>
          </div>
        </main>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card">
            <ProjectSocialBlock
              projectId={project.id}
              likeCount={Number(project.like_count ?? 0)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
