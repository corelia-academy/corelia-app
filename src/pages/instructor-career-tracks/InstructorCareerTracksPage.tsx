import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, Layers, Plus, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import type { CareerTrackDetail } from "@/types/career";
import {
  careerKeys,
  instructorCareerTracksQueryOptions,
} from "@/features/career/careerQueries";
import { setInstructorCareerTrackPublished } from "@/lib/careerTracks";
import { useAuth } from "@/stores/authStore";

const EMPTY_TRACKS: CareerTrackDetail[] = [];

export default function InstructorCareerTracksPage() {
  const { t } = useTranslation("instructor");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const options = instructorCareerTracksQueryOptions(user?.id);
  const tracksQuery = useQuery(options);
  const tracks = tracksQuery.data ?? EMPTY_TRACKS;
  const publishMutation = useMutation({
    mutationFn: ({ trackId, published }: { trackId: string; published: boolean }) =>
      setInstructorCareerTrackPublished(trackId, published),
    onMutate: async ({ trackId, published }) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData<CareerTrackDetail[]>(options.queryKey);
      queryClient.setQueryData<CareerTrackDetail[]>(options.queryKey, (current) =>
        current?.map((track) =>
          track.id === trackId ? { ...track, published } : track,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(options.queryKey, context.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: careerKeys.instructorList(user?.id || "missing") }),
  });
  const errorValue = publishMutation.error ?? tracksQuery.error;
  const error = errorValue
    ? errorValue instanceof Error
      ? errorValue.message
      : t("careerTracks.errors.loadFailed")
    : null;

  const stats = useMemo(() => {
    const published = tracks.filter((x) => x.published).length;
    const drafts = tracks.length - published;
    return { total: tracks.length, published, drafts };
  }, [tracks]);

  async function togglePublish(trackId: string, next: boolean) {
    try {
      await publishMutation.mutateAsync({ trackId, published: next });
    } catch { /* mutation error is rendered above */ }
  }

  if (tracksQuery.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="text-sm text-foreground-muted">{t("careerTracks.labels.loading")}</div>
      </div>
    );
  }

  return (
    <PageContainer>
      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <PageSectionCard className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">
              {t("careerTracks.list.title")}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("careerTracks.list.subtitle", { total: stats.total, published: stats.published, drafts: stats.drafts })}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate("/instructor/career-tracks/new")}
            className="rounded-full"
          >
            <Plus className="size-4" aria-hidden />
            {t("careerTracks.actions.create")}
          </Button>
        </div>
      </PageSectionCard>

      {tracks.length === 0 ? (
        <PageSectionCard>
          <EmptyState
            icon={<Layers className="size-5 text-foreground-subtle" aria-hidden />}
            title={t("careerTracks.list.emptyTitle")}
            description={t("careerTracks.list.emptyDescription")}
            action={
              <Button
                type="button"
                onClick={() => navigate("/instructor/career-tracks/new")}
              >
                {t("careerTracks.actions.create")}
              </Button>
            }
          />
        </PageSectionCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tracks.map((track) => (
            <PageSectionCard key={track.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {track.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-foreground-muted">
                    {track.description}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
                      {track.published ? t("careerTracks.labels.published") : t("careerTracks.labels.draft")}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-foreground-muted">
                      {t("careerTracks.labels.courseCount", { count: track.courseCount })}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    render={<Link to={`/instructor/career-tracks/${track.id}/edit`} />}
                    nativeButton={false}
                  >
                    <Pencil className="size-4" aria-hidden />
                    {t("careerTracks.actions.edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void togglePublish(track.id, !track.published)}
                  >
                    {track.published ? (
                      <>
                        <EyeOff className="size-4" aria-hidden />
                        {t("careerTracks.actions.unpublish")}
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" aria-hidden />
                        {t("careerTracks.actions.publish")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </PageSectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
