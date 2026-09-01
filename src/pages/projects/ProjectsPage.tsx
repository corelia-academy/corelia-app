import { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  FileImage,
  Github,
  GraduationCap,
  Heart,
  ImageIcon,
  MessageCircle,
  Package,
  PlayCircle,
  Presentation,
  ShieldAlert,
  Trophy,
} from "lucide-react";

import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { ProjectFilterBar } from "@/components/projects/ProjectFilterBar";
import { Button } from "@/components/ui/button";
import {
  type PublicDirectoryItem,
  type PublicProjectSort,
  type PublicProjectSourceFilter,
} from "@/lib/projects";
import { publicProjectDirectoryQueryOptions } from "@/features/projects/projectQueries";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/projects";

function normalizeSourceParam(value: string | null): PublicProjectSourceFilter {
  if (value === "hackathon" || value === "course" || value === "standalone") return value;
  return "all";
}

function normalizeSortParam(value: string | null): PublicProjectSort {
  if (value === "most_liked" || value === "most_commented") return value;
  return "newest";
}

function emptyDescriptionKey(source: PublicProjectSourceFilter):
  | "projects.emptyDescription"
  | "projects.emptyHackathonDescription"
  | "projects.emptyCourseDescription"
  | "projects.emptyShowcaseDescription" {
  if (source === "hackathon") return "projects.emptyHackathonDescription";
  if (source === "course") return "projects.emptyCourseDescription";
  if (source === "standalone") return "projects.emptyShowcaseDescription";
  return "projects.emptyDescription";
}

function ownerDisplay(item: PublicDirectoryItem): {
  ownerLabel: string | null;
  ownerHandle: string | null;
} {
  const owner = item.projectOwner;
  const handle = owner?.username || owner?.ocid || owner?.id || null;
  const label = owner?.full_name?.trim() || owner?.username?.trim() || owner?.ocid?.trim() || null;
  return { ownerLabel: label, ownerHandle: handle };
}

function DirectoryCover({ item }: { item: PublicDirectoryItem }) {
  const Icon = item.kind === "hackathon" ? Trophy : item.kind === "course" ? GraduationCap : ImageIcon;
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.title}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-raised">
      <div className="flex size-14 items-center justify-center rounded-full border border-border-subtle bg-surface-base text-foreground-subtle">
        <Icon className="size-7" aria-hidden />
      </div>
    </div>
  );
}

function DirectoryCard({ item }: { item: PublicDirectoryItem }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const project = item.kind === "showcase" ? (item.source as Project) : null;
  const { ownerHandle, ownerLabel } = ownerDisplay(item);
  const ownerText = ownerHandle ? `@${ownerHandle}` : ownerLabel;
  const badge =
    item.kind === "hackathon"
      ? t("projects.sourceHackathon")
      : item.kind === "course"
        ? t("projects.sourceCourse")
        : t("projects.sourceShowcase");

  const actions = project
    ? [
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
      ].filter((action) => Boolean(action.href))
    : [];
  const visibleActions = actions.slice(0, 4);
  const hiddenActionCount = Math.max(0, actions.length - visibleActions.length);

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={item.title}
      className={cn(
        "group flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-card transition-colors hover:border-border hover:bg-surface-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
      onClick={() => navigate(item.href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(item.href);
        }
      }}
    >
      <div className="aspect-video w-full overflow-hidden border-b border-border-subtle bg-surface-raised">
        <DirectoryCover item={item} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {item.title}
          </h2>
          <span className="shrink-0 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            {badge}
          </span>
        </div>

        {ownerText ? (
          <div className="mt-2 text-xs text-foreground-muted">
            {t("projects.byPrefix")}{" "}
            {ownerHandle ? (
              <NavLink
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                to={`/@${ownerHandle}`}
                onClick={(event) => event.stopPropagation()}
              >
                {ownerText}
              </NavLink>
            ) : (
              <span className="font-medium text-foreground">{ownerText}</span>
            )}
          </div>
        ) : null}

        <p className="mt-3 min-h-10 line-clamp-2 text-sm leading-5 text-foreground-muted">
          {item.summary || t("projects.card.noSummary")}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {project ? (
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
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
              {item.kind === "hackathon" ? (
                <Trophy className="size-4" aria-hidden />
              ) : (
                <GraduationCap className="size-4" aria-hidden />
              )}
              {badge}
            </span>
          )}

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
                  onClick={(event) => event.stopPropagation()}
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
            <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface-base text-foreground-muted transition-colors group-hover:bg-surface-raised group-hover:text-foreground">
              <ExternalLink className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const { t, i18n } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const source = normalizeSourceParam(searchParams.get("source"));
  const sort = normalizeSortParam(searchParams.get("sort"));
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const query = useInfiniteQuery(
    publicProjectDirectoryQueryOptions(locale, source, sort),
  );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = query.isPending;
  const loadingMore = query.isFetchingNextPage;
  const hasMore = query.hasNextPage;
  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : t("projects.errorDescription")
    : null;

  const updateSearch = useCallback(
    (next: { source?: PublicProjectSourceFilter; sort?: PublicProjectSort }) => {
      const params = new URLSearchParams(searchParams);
      const nextSource = next.source ?? source;
      const nextSort = next.sort ?? sort;

      if (nextSource === "all") params.delete("source");
      else params.set("source", nextSource);

      params.set("sort", nextSort);
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams, sort, source],
  );

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {t("projects.title")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">{t("projects.description")}</p>
        </div>
      </div>

      <ProjectFilterBar
        source={source}
        sort={sort}
        onSourceChange={(nextSource) => updateSearch({ source: nextSource })}
        onSortChange={(nextSort) => updateSearch({ sort: nextSort })}
      />

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <ShieldAlert className="size-6 text-foreground-subtle" aria-hidden />
            </div>
            <div className="max-w-lg">
              <h2 className="text-sm font-semibold text-foreground">{t("projects.errorTitle")}</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {error || t("projects.errorDescription")}
              </p>
            </div>
            <Button type="button" onClick={() => void query.refetch()}>
              {t("projects.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-14 text-center shadow-card">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <Package className="size-6 text-foreground-subtle" aria-hidden />
            </div>
            <div className="max-w-lg">
              <h2 className="text-sm font-semibold text-foreground">{t("projects.emptyTitle")}</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t(emptyDescriptionKey(source))}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <DirectoryCard
                  key={item.id}
                  item={item}
                />
              ))}
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-border-subtle bg-surface-base p-3 text-sm text-foreground-muted">
                {error}
              </div>
            ) : null}

            {hasMore ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void query.fetchNextPage()}>
                  {loadingMore ? t("projects.loading") : t("projects.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
