import { NavLink } from "react-router";
import {
  ArrowSquareOut,
  GithubLogo,
  Image as PhosphorImage,
  Presentation as PhosphorPresentation,
  Trophy as PhosphorTrophy,
} from "@phosphor-icons/react";
import { ExternalLink, Github, ImageIcon, Presentation, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProjectSocialBlock } from "@/components/projects/ProjectSocialBlock";
import { Chip } from "@/components/ui/chip";
import {
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
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
  ownerAvatarSeed?: string | null;
  ownerAvatarConfig?: import("../../../shared/avatarConfig").AvatarConfig | null;
  teamMembers?: PublicProjectTeamMember[];
  taxonomy?: Contest | null;
  awardLabel?: string | null;
  hearted?: boolean;
  className?: string;
  systemTaxonomy?: ProjectTaxonomyOption[];
  phosphorDuotone?: boolean;
  variant?: "default" | "hackathon";
};

export function ProjectCard({
  project,
  ownerLabel,
  ownerHandle,
  ownerAvatarUrl,
  ownerAvatarSeed,
  ownerAvatarConfig,
  teamMembers = [],
  taxonomy,
  awardLabel,
  hearted,
  className,
  systemTaxonomy = [],
  phosphorDuotone = false,
  variant = "default",
}: ProjectCardProps) {
  const { t, i18n } = useTranslation("common");
  const isHackathon = variant === "hackathon";
  const detailPath = `/projects/${project.slug || project.id}`;
  const logo = getProjectCoverImageUrl(project);
  const createdAt = new Date(project.created_at);
  const publishedDate = Number.isNaN(createdAt.getTime())
    ? project.created_at
    : new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(createdAt);
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
      avatarSeed: ownerAvatarSeed,
      avatarConfig: ownerAvatarConfig,
    },
    ...teamMembers
      .filter((member) => member.user_id !== project.owner_id)
      .map((member) => ({
        id: member.user_id,
        label: member.full_name?.trim() || member.username?.trim() || t("projects.editor.builder"),
        href: `/@${member.username?.trim() || member.id}`,
        avatarUrl: member.avatar_url,
        avatarSeed: member.avatar_seed,
        avatarConfig: member.avatar_config,
      })),
  ];
  const visiblePeople = people.slice(0, 3);
  const actions = [
    { href: project.demo_url, label: t("projects.detail.demo"), icon: ExternalLink, phosphorIcon: ArrowSquareOut },
    { href: project.repo_url, label: t("projects.detail.repo"), icon: Github, phosphorIcon: GithubLogo },
    { href: project.slide_url, label: t("projects.detail.slides"), icon: Presentation, phosphorIcon: PhosphorPresentation },
  ].filter((item) => item.href);
  const peopleContent = people.length === 1 ? (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar
        userId={project.owner_id}
        avatarUrl={ownerAvatarUrl}
        avatarSeed={ownerAvatarSeed}
        avatarConfig={ownerAvatarConfig}
        alt={ownerName}
        fallback={ownerName.charAt(0).toUpperCase()}
        size={isHackathon ? "Xsmall" : undefined}
      />
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
          <UserAvatar
            userId={person.id}
            avatarUrl={person.avatarUrl}
            avatarSeed={person.avatarSeed}
            avatarConfig={person.avatarConfig}
            alt={person.label}
            fallback={person.label.charAt(0).toUpperCase()}
            size={isHackathon ? "Xsmall" : undefined}
          />
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
  );
  const awardContent = displayAward ? (
    <div className={cn("mt-4 flex flex-wrap gap-1.5", isHackathon && "mt-2")}>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-label-small font-body text-primary">
        {phosphorDuotone ? <PhosphorTrophy className="size-3" weight="duotone" /> : <Trophy className="size-3" />}
        {displayAward}
      </span>
    </div>
  ) : null;
  const renderActions = (compact = false) => actions.length ? (
    <div className={compact ? "shrink-0" : "mt-auto pt-4"}>
      <div className={cn("flex gap-1", compact ? "justify-end" : "border-t border-border-subtle pt-4")}>
        {actions.map(({ href, label, icon: Icon, phosphorIcon: PhosphorIcon }) => (
          <a
            key={label}
            href={href!}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border border-border-subtle hover:bg-surface-raised",
              compact && "border-0",
            )}
          >
            {phosphorDuotone ? <PhosphorIcon className="size-4" weight="duotone" /> : <Icon className="size-4" />}
          </a>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <article
      className={cn(
        "group relative flex h-full min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface-base p-5 shadow-card transition-shadow hover:border-primary/40 hover:shadow-md",
        isHackathon && "h-60 rounded-lg p-4 shadow-none hover:shadow-none",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-3", isHackathon && "gap-2")}>
        <NavLink
          to={detailPath}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-raised",
            isHackathon && "size-12 rounded-full",
          )}
        >
          {logo ? (
            <img src={logo} alt="" className="size-full object-contain" loading="lazy" />
          ) : phosphorDuotone ? (
            <PhosphorImage className="size-7 text-foreground-subtle" weight="duotone" />
          ) : (
            <ImageIcon className="size-7 text-foreground-subtle" />
          )}
        </NavLink>
        {isHackathon ? (
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 break-words text-lg font-display font-medium text-foreground">
              <NavLink
                to={detailPath}
                className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {project.title}
              </NavLink>
            </h2>
            <p className="mt-0.5 text-label-small font-body text-foreground-subtle">
              {t("projects.card.publishedAt", { date: publishedDate })}
            </p>
          </div>
        ) : null}
        <ProjectSocialBlock
          projectId={project.id}
          likeCount={Number(project.like_count ?? 0)}
          hearted={hearted}
          phosphorDuotone={phosphorDuotone}
          className={cn("border-0 pt-0", isHackathon && "shrink-0")}
        />
      </div>
      {!isHackathon ? (
        <h2 className="mt-4 line-clamp-2 break-words text-heading-small font-display text-foreground">
          <NavLink
            to={detailPath}
            className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            {project.title}
          </NavLink>
        </h2>
      ) : null}
      <p className={cn("mt-2 min-h-16 line-clamp-3 text-body-medium font-body text-foreground-muted", isHackathon && "mt-6 min-h-0 text-body-medium")}>
        {project.summary || t("projects.card.noSummary")}
      </p>
      {isHackathon ? (
        technologies.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {technologies.map((technology) => (
              <Chip key={technology} size="xsmall" shape="circle">
                {technology}
              </Chip>
            ))}
          </div>
        ) : null
      ) : (
        <dl className="mt-5 space-y-3 text-body-small font-body">
          {technologies.length ? (
            <div className="flex items-start gap-3">
              <dt className="w-20 shrink-0 text-label-small font-body text-foreground-subtle">{t("projects.filters.techStacks")}</dt>
              <dd className="min-w-0 font-medium">{technologies.join(", ")}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <dt className="w-20 shrink-0 text-label-small font-body text-foreground-subtle">{t("projects.editor.builder")}</dt>
            <dd className="min-w-0 font-medium">{peopleContent}</dd>
          </div>
        </dl>
      )}
      {awardContent}
      {isHackathon ? (
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-6 text-body-small font-body">
          <div className="min-w-0">{peopleContent}</div>
          {renderActions(true)}
        </div>
      ) : renderActions()}
    </article>
  );
}
