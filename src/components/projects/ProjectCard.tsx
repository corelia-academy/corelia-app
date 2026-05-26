import type { KeyboardEvent, MouseEvent } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  ExternalLink,
  FileImage,
  Github,
  Heart,
  ImageIcon,
  MessageCircle,
  Package,
  PlayCircle,
  Presentation,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { getProjectCoverImageUrl } from "@/lib/projects";
import { projectSourceLabelKey } from "@/lib/projectSource";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/projects";

type ProjectCardProps = {
  project: Project;
  ownerLabel?: string | null;
  ownerHandle?: string | null;
  className?: string;
};

type ProjectAction = {
  key: string;
  label: string;
  href: string | null;
  icon: typeof ExternalLink;
};

function stopCardNavigation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function ProjectCover({ project }: { project: Project }) {
  const coverUrl = getProjectCoverImageUrl(project);
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={project.title}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-raised">
      <div className="flex size-14 items-center justify-center rounded-full border border-border-subtle bg-surface-base text-foreground-subtle">
        <ImageIcon className="size-7" aria-hidden />
      </div>
    </div>
  );
}

export function ProjectCard({
  project,
  ownerLabel,
  ownerHandle,
  className,
}: ProjectCardProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const detailPath = `/projects/${project.id}`;
  const ownerText = ownerHandle ? `@${ownerHandle}` : ownerLabel;
  const actions: ProjectAction[] = [
    { key: "demo", label: t("projects.detail.demo"), href: project.demo_url, icon: ExternalLink },
    { key: "repo", label: t("projects.detail.repo"), href: project.repo_url, icon: Github },
    { key: "slides", label: t("projects.detail.slides"), href: project.slide_url, icon: Presentation },
    {
      key: "screenshot",
      label: t("projects.detail.screenshot"),
      href: project.screenshot_url,
      icon: FileImage,
    },
    { key: "video", label: t("projects.detail.video"), href: project.video_url, icon: PlayCircle },
  ].filter((action) => Boolean(action.href));
  const visibleActions = actions.slice(0, 4);
  const hiddenActionCount = Math.max(0, actions.length - visibleActions.length);

  function openProject() {
    navigate(detailPath);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject();
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={project.title}
      className={cn(
        "group flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-card transition-colors hover:border-border hover:bg-surface-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      onClick={openProject}
      onKeyDown={handleKeyDown}
    >
      <div className="aspect-video w-full overflow-hidden border-b border-border-subtle bg-surface-raised">
        <ProjectCover project={project} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {project.title}
          </h2>
          <span className="shrink-0 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            {t(projectSourceLabelKey(project.source_type))}
          </span>
        </div>

        {ownerText ? (
          <div className="mt-2 text-xs text-foreground-muted">
            {t("projects.byPrefix")}{" "}
            {ownerHandle ? (
              <NavLink
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                to={`/u/${ownerHandle}`}
                onClick={stopCardNavigation}
              >
                {ownerText}
              </NavLink>
            ) : (
              <span className="font-medium text-foreground">{ownerText}</span>
            )}
          </div>
        ) : null}

        <p className="mt-3 min-h-10 line-clamp-2 text-sm leading-5 text-foreground-muted">
          {project.summary || t("projects.card.noSummary")}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1">
              <Heart className="size-4" aria-hidden />
              <span className="tabular-nums">{Number(project.like_count ?? 0)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-4" aria-hidden />
              <span className="tabular-nums">{Number(project.comment_count ?? 0)}</span>
            </span>
          </div>

          {visibleActions.length > 0 ? (
            <div className="flex items-center gap-1" aria-label={t("projects.card.links")}>
              {visibleActions.map((action) => {
                const Icon = action.icon;
                return (
                  <a
                    key={action.key}
                    href={action.href ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    title={action.label}
                    aria-label={action.label}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface-base text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={stopCardNavigation}
                  >
                    <Icon className="size-4" aria-hidden />
                  </a>
                );
              })}
              {hiddenActionCount > 0 ? (
                <span
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface-base text-sm font-semibold text-foreground-muted"
                  title={t("projects.card.moreLinks", { count: hiddenActionCount })}
                >
                  ...
                </span>
              ) : null}
            </div>
          ) : (
            <Package className="size-4 text-foreground-subtle" aria-hidden />
          )}
        </div>
      </div>
    </article>
  );
}
