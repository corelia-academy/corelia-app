import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  CheckCheck,
  Eye,
  PlusCircle,
  Timer,
  Loader2,
  Trash2,
  Trophy,
  Users,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteContest, listContests } from "@/lib/hackathons";
import { contestListImageUrl } from "@/lib/hackathonVisuals";
import type { Contest } from "@/types/hackathons";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  contestListLocationLabel,
  contestListStatusLabel,
  formatContestListDateRange,
} from "@/features/hackathons/list/contestListFormatters";
import {
  ContestListCardDateRowInstructor,
  ContestListCardThumbnail,
  ContestListMetricCellInstructor,
} from "@/features/hackathons/list/ContestListCardPrimitives";
import {
  EmptyState,
  PageContainer,
  PageSectionCard,
} from "@/components/layouts/PagePrimitives";
import { useAuth } from "@/stores/authStore";

export default function InstructorContests() {
  const { authInitialized, user } = useAuth();
  const { t, i18n } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const navigate = useNavigate();
  const [items, setItems] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contestToDelete, setContestToDelete] = useState<Contest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authInitialized) return;

    let cancelled = false;
    listContests(user ?? null)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("instructor.loadListFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, t, user, i18n.language]);

  const stats = useMemo(() => {
    const total = items.length;
    const draft = items.filter((item) => item.status === "draft").length;
    const accepting = items.filter((item) => item.status === "published").length;
    const running = items.filter((item) => item.status === "running").length;
    const ended = items.filter((item) => item.status === "ended").length;
    const submissions = items.reduce(
      (sum, item) => sum + item.metrics_snapshot.submissions_total,
      0,
    );
    return { total, draft, accepting, running, ended, submissions };
  }, [items]);

  async function handleDeleteContest() {
    if (!contestToDelete) return;

    setDeletingId(contestToDelete.id);
    try {
      await deleteContest(contestToDelete.id);
      setItems((current) => current.filter((item) => item.id !== contestToDelete.id));
      setContestToDelete(null);
      toast.success(t("instructor.deleteSuccess"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("instructor.deleteFailed");
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-foreground-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("instructor.loadingWorkspace")}
      </div>
    );
  }

  return (
    <PageContainer>
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <PageSectionCard className="mb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {t("instructor.hero.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {t("instructor.hero.title")}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted sm:text-sm">
              {t("instructor.hero.description")}
            </p>
            <p className="mt-2 text-sm text-foreground-muted sm:text-sm">
              {t("instructor.statsSummary", {
                total: stats.total,
                draft: stats.draft,
                accepting: stats.accepting,
                running: stats.running,
                ended: stats.ended,
                submissions: stats.submissions,
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {t("instructor.hero.pillApplications")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
              {t("instructor.hero.pillJudging")}
            </span>
            <Button type="button" onClick={() => navigate("/hackathons/new")}>
              <PlusCircle className="size-4" aria-hidden />
              {t("instructor.hero.create")}
            </Button>
          </div>
        </div>
      </PageSectionCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.total")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.draft")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.draft}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.accepting")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.accepting}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCheck className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.running")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.running}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Timer className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.ended")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.ended}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {t("instructor.stats.submissions")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.submissions}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface-base">
          <EmptyState
            icon={<Trophy className="size-6 text-foreground-subtle" aria-hidden />}
            title={t("instructor.empty.title")}
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => navigate("/hackathons/new")}
              >
                {t("instructor.empty.createFirst")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((contest) => {
            const listImg = contestListImageUrl(contest);
            const contestSlug = contest.slug?.trim() || null;
            return (
            <article
              key={contest.id}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-base transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface-raised"
            >
              <ContestListCardThumbnail
                src={listImg}
                aspectClassName="aspect-[2/1]"
                surfaceClassName="bg-linear-to-br from-primary/10 via-surface-raised to-surface-raised"
                emptyMinHeightClassName="min-h-[96px]"
                trophyIconClassName="size-12 text-primary/35"
              />
              <button
                type="button"
                className="flex flex-1 flex-col p-4 text-left"
                onClick={() =>
                  navigate(contestSlug ? `/hackathons/${contestSlug}/manage/overview` : "/hackathons/manage")
                }
              >
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-foreground">
                    {contestListStatusLabel(
                      contest.status,
                      translate,
                      "instructor",
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs font-medium text-foreground">
                    {contest.status === "draft" ? (
                      <>
                        <EyeOff className="mr-1 size-3.5" aria-hidden />
                        {t("instructor.listItem.pillPublicDraft")}
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 size-3.5" aria-hidden />
                        {t("instructor.listItem.pillPublicReady")}
                      </>
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs font-medium text-foreground">
                    {contestListLocationLabel(
                      contest.location,
                      translate,
                      "instructor",
                    )}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-foreground">
                  {contest.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-foreground-muted">
                  {contest.tagline}
                </p>
                <div className="mt-4 grid gap-2 text-sm text-foreground-muted">
                  <ContestListCardDateRowInstructor>
                    {formatContestListDateRange(
                      contest.starts_at,
                      contest.ends_at,
                      translate,
                      "instructor",
                    )}
                  </ContestListCardDateRowInstructor>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ContestListMetricCellInstructor>
                      {t("instructor.listItem.metricsRegistrations", {
                        total: contest.metrics_snapshot.registrations_total,
                        approved: contest.metrics_snapshot.approved_registrations,
                      })}
                    </ContestListMetricCellInstructor>
                    <ContestListMetricCellInstructor>
                      {t("instructor.listItem.metricsSubmissions", {
                        submissions: contest.metrics_snapshot.submissions_total,
                        winners: contest.metrics_snapshot.published_winners,
                      })}
                    </ContestListMetricCellInstructor>
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons",
                      )
                    }
                  >
                    {t("instructor.listItem.viewPublic")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(contestSlug ? `/hackathons/${contestSlug}/manage/overview` : "/hackathons/manage")
                    }
                  >
                    {t("instructor.listItem.openWorkspace")}
                  </Button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t("instructor.listItem.moreActions")}
                    className="inline-flex size-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                  >
                    <MoreHorizontal className="size-5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        navigate(
                          contestSlug ? `/hackathons/${contestSlug}/manage/overview` : "/hackathons/manage",
                        )
                      }
                    >
                      {t("instructor.listItem.openWorkspace")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        navigate(
                          contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons",
                        )
                      }
                    >
                      {t("instructor.listItem.viewPublic")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setContestToDelete(contest)}
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden />
                      {t("instructor.listItem.deleteContest")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={contestToDelete != null}
        onOpenChange={(open) => {
          if (!open && deletingId == null) {
            setContestToDelete(null);
          }
        }}
      >
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>{t("instructor.deleteDialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground-muted">
            {contestToDelete?.title
              ? t("instructor.deleteDialog.descriptionWithTitle", { title: contestToDelete.title })
              : t("instructor.deleteDialog.description")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setContestToDelete(null)}
              disabled={deletingId != null}
            >
              {t("instructor.deleteDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteContest()}
              disabled={contestToDelete == null || deletingId != null}
            >
              {deletingId != null ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("instructor.deleteDialog.confirmDeleting")}
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden />
                  {t("instructor.listItem.deleteContest")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
