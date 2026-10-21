import { useState } from "react";
import { NavLink } from "react-router";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/imageUrl";
import {
  ArrowSquareOut,
  BookmarkSimpleIcon as PhosphorBookmark,
  GithubLogo,
  Image as PhosphorImage,
  Presentation as PhosphorPresentation,
  Trophy as PhosphorTrophy,
} from "@phosphor-icons/react";
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
  hearted?: boolean;
  className?: string;
  systemTaxonomy?: ProjectTaxonomyOption[];
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
  hearted,
  className,
  systemTaxonomy = [],
  variant = "default",
}: ProjectCardProps) {
  const { t, i18n } = useTranslation("common");

  const [isSaved, setIsSaved] = useState(false);
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
  const awards = taxonomy?.winner_awards?.filter((award) => award.project_id === project.id).sort((a, b) => a.sort_order - b.sort_order) ?? [];
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
  const actionItems = {
    demo: { href: project.demo_url, label: t("projects.detail.demo"), icon: ArrowSquareOut },
    repo: { href: project.repo_url, label: t("projects.detail.repo"), icon: GithubLogo },
    slides: { href: project.slide_url, label: t("projects.detail.slides"), icon: PhosphorPresentation },
  };
  const actions = [actionItems.repo, actionItems.slides, actionItems.demo].filter((item) => item.href);
  const peopleContent = people.length === 1 ? (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar
        userId={project.owner_id}
        avatarUrl={ownerAvatarUrl}
        avatarSeed={ownerAvatarSeed}
        avatarConfig={ownerAvatarConfig}
        alt={ownerName}
        fallback={ownerName.charAt(0).toUpperCase()}
        size="Xsmall"
      />
      {ownerHandle ? (
        <NavLink to={`/@${ownerHandle}`} className="min-w-0 truncate text-foreground-subtle hover:underline">
          {ownerName}
        </NavLink>
      ) : (
        <span className="min-w-0 truncate text-foreground-subtle">{ownerName}</span>
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
            size="Xsmall"
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
  const awardContent = awards.length ? (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {awards.map((award) => <span key={award.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-label-small font-body text-primary">
        <PhosphorTrophy className="size-3" weight="duotone" />
        {award.label || t("projects.editor.winner")}
      </span>)}
    </div>
  ) : null;
  const renderActions = (compact = false, directoryCard = false) => actions.length ? (
    <div className={compact ? "shrink-0" : "mt-auto pt-4"}>
      <div className={cn("flex gap-1", compact ? "justify-end" : "border-t border-border-subtle pt-4", directoryCard && "gap-4")}>
        {actions.map(({ href, label, icon: Icon }) => (
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
              directoryCard && "size-5 rounded-none p-0 hover:bg-transparent hover:text-foreground-muted",
            )}
          >
            <Icon className={cn("size-4", directoryCard && "size-5")} weight="duotone" />
          </a>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <article
      className={cn(
        "motion-hover-card group relative flex h-full min-h-60 min-w-0 flex-col rounded-md border border-border bg-surface-base p-4 shadow-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <NavLink
          to={detailPath}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-raised",
          )}
        >
          {logo ? (
            <img src={optimizedImageUrl(logo, { width: 56, resize: "contain" })} srcSet={optimizedImageSrcSet(logo, 56, { resize: "contain" })} decoding="async" alt="" className="size-full object-contain" loading="lazy" />
          ) : (
            <PhosphorImage className="size-7 text-foreground-subtle" weight="duotone" />
          )}
        </NavLink>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-heading-medium font-display text-foreground">
            <NavLink
              to={detailPath}
              className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {project.title}
            </NavLink>
          </h2>
          <p className="mt-1 text-body-small font-body leading-[1.25] text-foreground-subtle">
            {t("projects.card.publishedAt", { date: publishedDate })}
          </p>
        </div>
        <ProjectSocialBlock
          projectId={project.id}
          likeCount={Number(project.like_count ?? 0)}
          hearted={hearted}
          phosphorDuotone
          className="shrink-0 border-0 pt-0"
        />
      </div>
      <p className="mt-4 min-h-[35px] line-clamp-3 text-body-medium font-body leading-[1.4] text-catalog-subtitle">
        {project.summary || t("projects.card.noSummary")}
      </p>
      {technologies.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {technologies.map((technology) => (
            <Chip
              key={technology}
              size="xsmall"
              shape="circle"
              className="py-1 text-[10px] leading-[1.2] text-neutral-100"
            >
              {technology}
            </Chip>
          ))}
        </div>
      ) : null}
      {awardContent}
      <div className="mt-auto flex min-w-0 items-center justify-between gap-3 pt-3 text-body-small font-body leading-[1.25]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-foreground-subtle">{t("projects.byPrefix")}</span>
          {peopleContent}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {renderActions(true, true)}
          {actions.length ? <span className="h-5 w-px bg-border-subtle" aria-hidden /> : null}
          <PhosphorBookmark
            className={cn(
              "size-5 shrink-0 cursor-pointer text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              !isSaved && "hover:text-foreground-muted",
              isSaved && "fill-current text-primary [&>path:first-child]:opacity-100",
            )}
            weight="duotone"
            role="button"
            tabIndex={0}
            aria-label={t("actions.save")}
            aria-pressed={isSaved}
            onClick={() => setIsSaved((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsSaved((current) => !current);
              }
            }}
          />
        </div>
      </div>
    </article>
  );
}
