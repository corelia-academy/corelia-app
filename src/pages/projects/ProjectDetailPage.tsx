import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";
import {
  ArrowLeft,
  ExternalLink,
  FileImage,
  Github,
  ImageIcon,
  Package,
  PlayCircle,
  Presentation,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { FollowButton } from "@/components/social/FollowButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectById, getProjectCoverImageUrl, type PublicProjectEntry } from "@/lib/projects";
import { listMyProjectHeartIds } from "@/lib/projectSocial";
import { projectSourceLabelKey } from "@/lib/projectSource";
import { useAuth } from "@/stores/authStore";
import type { Project } from "@/types/projects";

function sourceLink(project: Project): string | null {
  if (project.source_type === "contest" && project.source_id) {
    return `/hackathons/${project.source_id}/overview`;
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

function ProjectHero({ project }: { project: Project }) {
  const coverUrl = getProjectCoverImageUrl(project);
  if (coverUrl) {
    return (
      <div className="max-h-[480px] overflow-hidden rounded-lg border border-border-subtle bg-surface-raised shadow-card">
        <img src={coverUrl} alt={project.title} className="h-full max-h-[480px] w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised shadow-card">
      <div className="flex size-20 items-center justify-center rounded-full border border-border-subtle bg-surface-base text-foreground-subtle">
        <ImageIcon className="size-10" aria-hidden />
      </div>
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
  const { id } = useParams();
  const { t, i18n } = useTranslation("common");
  const { user } = useAuth();
  const [entry, setEntry] = useState<PublicProjectEntry | null>(null);
  const [hearted, setHearted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await getProjectById(id, i18n.language);
      if (!result) {
        setEntry(null);
        setNotFound(true);
        return;
      }
      setEntry(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("projects.errorDescription"));
    } finally {
      setLoading(false);
    }
  }, [id, i18n.language, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || !entry?.project.id) {
      setHearted(false);
      return;
    }
    let cancelled = false;
    void listMyProjectHeartIds([entry.project.id]).then((set) => {
      if (!cancelled) setHearted(set.has(entry.project.id));
    });
    return () => {
      cancelled = true;
    };
  }, [entry?.project.id, user]);

  const owner = useMemo(() => ownerDisplay(entry?.owner ?? null), [entry?.owner]);

  if (loading) return <DetailSkeleton />;

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
            <Button type="button" onClick={() => void load()}>
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
  const href = sourceLink(project);
  const description = project.summary || t("projects.detail.noDescription");

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
    project.screenshot_url
      ? {
          key: "screenshot",
          label: t("projects.detail.screenshot"),
          href: project.screenshot_url,
          external: true,
          icon: FileImage,
        }
      : null,
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

      <ProjectHero project={project} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <main className="min-w-0">
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {project.title}
              </h1>
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
                    to={`/u/${owner.handle}`}
                  >
                    @{owner.handle}
                  </NavLink>
                ) : (
                  <span className="font-medium text-foreground">{owner.label}</span>
                )}
              </p>
            ) : null}

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
            {project.visibility === "public" ? (
              <FollowButton
                subject={{ type: "project", id: project.id }}
                followerCount={project.follower_count ?? 0}
                className="mb-3 w-full"
              />
            ) : null}
            <ProjectSocialBlock
              projectId={project.id}
              ownerId={project.owner_id}
              likeCount={Number(project.like_count ?? 0)}
              hearted={hearted}
              variant="default"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

