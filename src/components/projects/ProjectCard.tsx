import { NavLink } from "react-router";
import { ExternalLink, Github, ImageIcon, Presentation, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { getProjectCoverImageUrl } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { PublicProjectTeamMember } from "@/lib/projectCollaboration";
import type { Contest } from "@/types/hackathons";
import type { Project } from "@/types/projects";
import { projectTaxonomyNames, type ProjectTaxonomyOption } from "@/lib/projectTaxonomy";

type ProjectCardProps = {
  project: Project;
  ownerLabel?: string | null;
  ownerHandle?: string | null;
  ownerAvatarUrl?: string | null;
  teamMembers?: PublicProjectTeamMember[];
  taxonomy?: Contest | null;
  awardLabel?: string | null;
  hearted?: boolean;
  className?: string;
  systemTaxonomy?: ProjectTaxonomyOption[];
};

export function ProjectCard({
  project,
  ownerLabel,
  ownerHandle,
  ownerAvatarUrl,
  teamMembers = [],
  taxonomy,
  awardLabel,
  hearted,
  className,
  systemTaxonomy = [],
}: ProjectCardProps) {
  const { t } = useTranslation("common");
  const detailPath = `/projects/${project.slug || project.id}`;
  const logo = getProjectCoverImageUrl(project);
  const technologies = projectTaxonomyNames(project.hackathon_tech_stack_ids ?? [], project.custom_tech_stack_names ?? [], systemTaxonomy.filter((item) => item.kind === "technology"), taxonomy?.tech_stacks ?? []);
  const awards = taxonomy?.winner_awards?.filter((award) => award.project_id === project.id) ?? [];
  const displayAward = awardLabel || (awards.length ? awards[0].label || t("projects.editor.winner") : null);
  const ownerName = ownerLabel?.trim() || (ownerHandle ? `@${ownerHandle}` : t("projects.editor.builder"));
  const people = [
    {
      id: project.owner_id,
      label: ownerName,
      href: ownerHandle ? `/@${ownerHandle}` : null,
      avatarUrl: ownerAvatarUrl,
    },
    ...teamMembers
      .filter((member) => member.user_id !== project.owner_id)
      .map((member) => ({
        id: member.user_id,
        label: member.full_name?.trim() || member.username?.trim() || t("projects.editor.builder"),
        href: `/@${member.username?.trim() || member.id}`,
        avatarUrl: member.avatar_url,
      })),
  ];
  const visiblePeople = people.slice(0, 3);
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
      <h2 className="mt-4 line-clamp-2 break-words text-heading-small font-display text-foreground">
        <NavLink
          to={detailPath}
          className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {project.title}
        </NavLink>
      </h2>
      <p className="mt-2 min-h-16 line-clamp-3 text-body-medium font-body text-foreground-muted">
        {project.summary || t("projects.card.noSummary")}
      </p>
      <dl className="mt-5 space-y-3 text-body-small font-body">
        {technologies.length ? (
          <div className="flex items-start gap-3">
            <dt className="w-20 shrink-0 text-label-small font-body text-foreground-subtle">{t("projects.filters.techStacks")}</dt>
            <dd className="min-w-0 font-medium">{technologies.join(", ")}</dd>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <dt className="w-20 shrink-0 text-label-small font-body text-foreground-subtle">{t("projects.editor.builder")}</dt>
          <dd className="min-w-0 font-medium">
            {people.length === 1 ? (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar>
                  <AvatarImage src={ownerAvatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{ownerName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {ownerHandle ? (
                  <NavLink to={`/@${ownerHandle}`} className="min-w-0 truncate hover:underline">
                    {ownerName}
                  </NavLink>
                ) : (
                  <span className="min-w-0 truncate">{ownerName}</span>
                )}
              </div>
            ) : (
              <AvatarGroup aria-label={t("projects.team.members")}>
                {visiblePeople.map((person) => {
                  const avatar = (
                    <Avatar>
                      <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback>{person.label.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  );
                  return person.href ? (
                    <NavLink key={person.id} to={person.href} title={person.label} aria-label={person.label}>
                      {avatar}
                    </NavLink>
                  ) : (
                    <span key={person.id} title={person.label} aria-label={person.label}>
                      {avatar}
                    </span>
                  );
                })}
                {people.length > visiblePeople.length ? (
                  <AvatarGroupCount
                    title={t("projects.team.moreMembers", { count: people.length - visiblePeople.length })}
                    aria-label={t("projects.team.moreMembers", { count: people.length - visiblePeople.length })}
                  >
                    +{people.length - visiblePeople.length}
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            )}
          </dd>
        </div>
      </dl>
      {displayAward ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-label-small font-body text-primary">
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
