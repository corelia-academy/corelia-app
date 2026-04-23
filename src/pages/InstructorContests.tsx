import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteContest, listContests } from "@/lib/contests";
import type { Contest } from "@/types/contests";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  EmptyState,
  PageContainer,
  PageSectionCard,
} from "@/components/layouts/PagePrimitives";

type ContestsT = TFunction<"contests", undefined>;

function statusLabel(status: Contest["status"], t: ContestsT): string {
  switch (status) {
    case "draft":
      return t("instructor.statusLabel.draft");
    case "published":
      return t("instructor.statusLabel.published");
    case "running":
      return t("instructor.statusLabel.running");
    case "ended":
      return t("instructor.statusLabel.ended");
    default:
      return t("instructor.statusLabel.unknown");
  }
}

function locationLabel(loc: Contest["location"], t: ContestsT): string {
  switch (loc) {
    case "online":
      return t("instructor.locationLabel.online");
    case "offline":
      return t("instructor.locationLabel.offline");
    case "hybrid":
      return t("instructor.locationLabel.hybrid");
    default:
      return t("instructor.locationLabel.unknown");
  }
}

function formatDateRange(
  startsAt: string | null,
  endsAt: string | null,
  t: ContestsT,
): string {
  if (!startsAt && !endsAt) return t("instructor.dateRangeUnknown");
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleDateString(intlLocale())} - ${new Date(
      endsAt,
    ).toLocaleDateString(intlLocale())}`;
  }
  if (startsAt)
    return t("instructor.dateStartPrefix", {
      date: new Date(startsAt).toLocaleDateString(intlLocale()),
    });
  return t("instructor.dateEndPrefix", {
    date: new Date(endsAt as string).toLocaleDateString(intlLocale()),
  });
}

export default function InstructorContests() {
  const { t } = useTranslation("contests");
  const navigate = useNavigate();
  const [items, setItems] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contestToDelete, setContestToDelete] = useState<Contest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listContests()
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
  }, [t]);

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
  const featured = items[0] ?? null;

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
      <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-muted-foreground">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("instructor.hero.eyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {t("instructor.hero.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-sm">
              {t("instructor.hero.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("instructor.hero.pillApplications")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("instructor.hero.pillJudging")}
            </span>
            <Button type="button" onClick={() => navigate("/instructor/contests/new")}>
              <PlusCircle className="size-4" aria-hidden />
              {t("instructor.hero.create")}
            </Button>
          </div>
        </div>
      </PageSectionCard>

      {featured && (
        <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-lg border border-border-subtle bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("instructor.featured.eyebrow")}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {featured.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {featured.tagline}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted/70 px-3 py-2 text-xs font-medium text-foreground">
                {statusLabel(featured.status, t)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("instructor.featured.schedule")}
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {formatDateRange(featured.starts_at, featured.ends_at, t)}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("instructor.featured.registrations")}
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.metrics_snapshot.registrations_total} tổng · {featured.metrics_snapshot.approved_registrations} duyệt
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("instructor.featured.submissions")}
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.metrics_snapshot.submissions_total} bài nộp
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("instructor.featured.publicSurface")}
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.status === "draft"
                    ? t("instructor.featured.publicDraft")
                    : t("instructor.featured.publicReady")}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => navigate(`/instructor/contests/${featured.id}/manage`)}
              >
                {t("instructor.featured.openWorkspace")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/contests/${featured.id}`)}
              >
                {t("instructor.featured.viewPublic")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setContestToDelete(featured)}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("instructor.listItem.deleteContest")}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-card p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("instructor.workflow.eyebrow")}
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">
                  {t("instructor.workflow.applicationsTitle")}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("instructor.workflow.applicationsDescription")}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">
                  {t("instructor.workflow.judgingTitle")}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("instructor.workflow.judgingDescription")}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">
                  {t("instructor.workflow.publicTitle")}
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("instructor.workflow.publicDescription")}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("instructor.stats.total")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("instructor.stats.draft")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.draft}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("instructor.stats.running")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.running}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Timer className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("instructor.stats.ended")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.ended}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
        <div className="mt-4 rounded-lg border border-border-subtle bg-card shadow-card">
          <EmptyState
            icon={<Trophy className="size-6 text-muted-foreground" aria-hidden />}
            title={t("instructor.empty.title")}
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => navigate("/instructor/contests/new")}
              >
                {t("instructor.empty.createFirst")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((contest) => (
            <article
              key={contest.id}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                className="flex flex-1 flex-col p-4 text-left"
                onClick={() => navigate(`/instructor/contests/${contest.id}/manage`)}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-foreground">
                    {statusLabel(contest.status, t)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
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
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
                    {locationLabel(contest.location, t)}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-foreground">
                  {contest.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {contest.tagline}
                </p>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <div className="rounded-md border border-border-subtle bg-background px-3 py-2">
                    {formatDateRange(contest.starts_at, contest.ends_at, t)}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-border-subtle bg-background px-3 py-2">
                      {t("instructor.listItem.metricsRegistrations", {
                        total: contest.metrics_snapshot.registrations_total,
                        approved: contest.metrics_snapshot.approved_registrations,
                      })}
                    </div>
                    <div className="rounded-md border border-border-subtle bg-background px-3 py-2">
                      {t("instructor.listItem.metricsSubmissions", {
                        submissions: contest.metrics_snapshot.submissions_total,
                        winners: contest.metrics_snapshot.published_winners,
                      })}
                    </div>
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(`/contests/${contest.id}`)}
                  >
                    {t("instructor.listItem.viewPublic")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/instructor/contests/${contest.id}/manage`)}
                  >
                    {t("instructor.listItem.openWorkspace")}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setContestToDelete(contest)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t("instructor.listItem.delete")}
                </Button>
              </div>
            </article>
          ))}
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
          <p className="text-sm text-muted-foreground">
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
