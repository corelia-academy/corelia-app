import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Package, ShieldAlert } from "lucide-react";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/projects/ProjectCardSkeleton";
import { ProjectFilterBar } from "@/components/projects/ProjectFilterBar";
import { Button } from "@/components/ui/button";
import {
  listPublicProjects,
  type PublicProjectEntry,
  type PublicProjectSort,
  type PublicProjectSourceFilter,
} from "@/lib/projects";

const PAGE_SIZE = 12;

type ProjectGalleryEntry = PublicProjectEntry & {
  ownerLabel: string | null;
  ownerHandle: string | null;
};

function normalizeSourceParam(value: string | null): PublicProjectSourceFilter {
  if (value === "hackathon" || value === "course" || value === "standalone") return value;
  return "all";
}

function normalizeSortParam(value: string | null): PublicProjectSort {
  if (value === "most_liked" || value === "most_commented") return value;
  return "newest";
}

function toGalleryEntry(entry: PublicProjectEntry): ProjectGalleryEntry {
  const owner = entry.owner;
  const handle = owner?.username || owner?.ocid || owner?.id || null;
  const label = owner?.full_name?.trim() || owner?.username?.trim() || owner?.ocid?.trim() || null;
  return { ...entry, ownerLabel: label, ownerHandle: handle };
}

export default function ProjectsPage() {
  const { t, i18n } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const source = normalizeSourceParam(searchParams.get("source"));
  const sort = normalizeSortParam(searchParams.get("sort"));
  const [items, setItems] = useState<ProjectGalleryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPublicProjects({
        locale: i18n.language,
        source,
        sort,
        limit: PAGE_SIZE,
        cursor: null,
      });
      setItems(result.items.map(toGalleryEntry));
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("projects.errorDescription"));
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [i18n.language, sort, source, t]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await listPublicProjects({
          locale: i18n.language,
          source,
          sort,
          limit: PAGE_SIZE,
          cursor: null,
        });
        if (cancelled) return;
        setItems(result.items.map(toGalleryEntry));
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("projects.errorDescription"));
        setItems([]);
        setNextCursor(null);
        setHasMore(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, sort, source, t]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await listPublicProjects({
        locale: i18n.language,
        source,
        sort,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setItems((current) => [...current, ...result.items.map(toGalleryEntry)]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("projects.errorDescription"));
    } finally {
      setLoadingMore(false);
    }
  }

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
            <Button type="button" onClick={() => void loadFirstPage()}>
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
                {t("projects.emptyDescription")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ project, ownerHandle, ownerLabel }) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  ownerHandle={ownerHandle}
                  ownerLabel={ownerLabel}
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
                <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void handleLoadMore()}>
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

