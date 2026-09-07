import { NavLink } from "react-router";
import { ExternalLink, Github, ImageIcon, Presentation, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { getProjectCoverImageUrl } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { Contest } from "@/types/hackathons";
import type { Project } from "@/types/projects";

type ProjectCardProps = {
  project: Project;
  ownerLabel?: string | null;
  ownerHandle?: string | null;
  taxonomy?: Contest | null;
  awardLabel?: string | null;
  hearted?: boolean;
  className?: string;
};

export function ProjectCard({
  project,
  ownerLabel,
  ownerHandle,
  taxonomy,
  awardLabel,
  hearted,
  className,
}: ProjectCardProps) {
  const { t } = useTranslation("common");
  const detailPath = `/projects/${project.slug || project.id}`;
  const logo = getProjectCoverImageUrl(project);
  const technologies = taxonomy?.tech_stacks?.filter((item) => project.hackathon_tech_stack_ids?.includes(item.id)) ?? [];
  const awards = taxonomy?.winner_awards?.filter((award) => award.project_id === project.id) ?? [];
  const displayAward = awardLabel || (awards.length ? awards[0].label || t("projects.editor.winner") : null);
  const actions = [
    { href: project.demo_url, label: t("projects.detail.demo"), icon: ExternalLink },
    { href: project.repo_url, label: t("projects.detail.repo"), icon: Github },
    { href: project.slide_url, label: t("projects.detail.slides"), icon: Presentation },
  ].filter((item) => item.href);

  return (
    <article
      className={cn(
        "group relative flex h-full min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card transition-shadow hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <NavLink
          to={detailPath}
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"
        >
          {logo ? (
            <img src={logo} alt="" className="size-full object-contain" loading="lazy" />
          ) : (
            <ImageIcon className="size-7 text-foreground-subtle" />
          )}
        </NavLink>
        <ProjectSocialBlock
          projectId={project.id}
          likeCount={Number(project.like_count ?? 0)}
          hearted={hearted}
          className="border-0 pt-0"
        />
      </div>
      <h2 className="mt-4 line-clamp-2 break-words text-lg font-semibold leading-snug">
        <NavLink
          to={detailPath}
          className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {project.title}
        </NavLink>
      </h2>
      <p className="mt-2 min-h-16 line-clamp-3 text-sm leading-6 text-foreground-muted">
        {project.summary || t("projects.card.noSummary")}
      </p>
      <dl className="mt-5 space-y-3 text-xs">
        {technologies.length ? (
          <div className="flex items-start gap-3">
            <dt className="w-20 shrink-0 text-foreground-subtle">{t("projects.filters.techStacks")}</dt>
            <dd className="min-w-0 font-medium">{technologies.map((item) => item.name).join(", ")}</dd>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <dt className="w-20 shrink-0 text-foreground-subtle">{t("projects.editor.builder")}</dt>
          <dd className="min-w-0 truncate font-medium">
            {ownerHandle ? (
              <NavLink to={`/@${ownerHandle}`} className="hover:underline">
                {ownerLabel || `@${ownerHandle}`}
              </NavLink>
            ) : (
              ownerLabel || t("projects.editor.builder")
            )}
          </dd>
        </div>
      </dl>
      {displayAward ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Trophy className="size-3" />
            {displayAward}
          </span>
        </div>
      ) : null}
      {actions.length ? (
        <div className="mt-auto pt-4">
          <div className="flex gap-1 border-t border-border-subtle pt-4">
            {actions.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href!}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className="flex size-10 items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-raised"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
