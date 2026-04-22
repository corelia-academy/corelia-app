import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarBlank,
  Checks,
  ClockCountdown,
  Eye,
  EyeSlash,
  PlusCircle,
  Spinner,
  Trash,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
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

function statusLabel(status: Contest["status"]): string {
  switch (status) {
    case "draft":
      return "Bản nháp";
    case "published":
      return "Đang nhận hồ sơ";
    case "running":
      return "Đang diễn ra";
    case "ended":
      return "Đã kết thúc";
    default:
      return "—";
  }
}

function locationLabel(loc: Contest["location"]): string {
  switch (loc) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "hybrid":
      return "Hybrid";
    default:
      return "—";
  }
}

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Chưa công bố lịch thi";
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleDateString("vi-VN")} - ${new Date(
      endsAt,
    ).toLocaleDateString("vi-VN")}`;
  }
  if (startsAt) return `Bắt đầu ${new Date(startsAt).toLocaleDateString("vi-VN")}`;
  return `Kết thúc ${new Date(endsAt as string).toLocaleDateString("vi-VN")}`;
}

export default function InstructorContests() {
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
          setError(err instanceof Error ? err.message : "Không thể tải danh sách cuộc thi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      toast.success("Đã xoá cuộc thi.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể xoá cuộc thi lúc này.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải khu vực cuộc thi...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Khu vực cuộc thi
            </p>
            <h2 className="mt-2 text-2xl font-normal tracking-tight text-foreground">
              Danh sách contests đang vận hành
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground sm:text-[15px]">
              Điều phối hackathon và contest như một lớp vận hành song song với hoạt động giảng dạy, nhưng có thêm ban giám khảo, đơn vị đồng tổ chức và trang công khai riêng.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
              Duyệt hồ sơ
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
              Luồng chấm điểm
            </span>
            <Button type="button" onClick={() => navigate("/instructor/contests/new")}>
              <PlusCircle className="size-4" weight="duotone" />
              Tạo cuộc thi mới
            </Button>
          </div>
        </div>
      </section>

      {featured && (
        <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Đang được quan tâm
                </p>
                <h3 className="mt-2 text-xl font-normal tracking-tight text-foreground">
                  {featured.title}
                </h3>
                <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
                  {featured.tagline}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted/70 px-3 py-1.5 text-[12px] font-medium text-foreground">
                {statusLabel(featured.status)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Lịch contest
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {formatDateRange(featured.starts_at, featured.ends_at)}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Hồ sơ
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.metrics_snapshot.registrations_total} tổng · {featured.metrics_snapshot.approved_registrations} duyệt
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Bài nộp
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.metrics_snapshot.submissions_total} bài nộp
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Bề mặt public
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {featured.status === "draft" ? "Chưa công khai" : "Đã sẵn sàng cho thí sinh"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => navigate(`/instructor/contests/${featured.id}/manage`)}
              >
                Mở khu vực vận hành
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/contests/${featured.id}`)}
              >
                Xem trang công khai
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setContestToDelete(featured)}
              >
                <Trash className="size-4" weight="duotone" />
                Xoá contest
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Cách vận hành
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">Duyệt hồ sơ</div>
                <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  Corelia giữ quyền xét duyệt hồ sơ và quyết định đội vào vòng.
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">Chấm điểm</div>
                <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  Ban giám khảo và đơn vị đồng tổ chức tham gia ở đúng lớp quyền, không dùng chung mô hình biên soạn khóa học.
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-sm font-medium text-foreground">Trang công khai</div>
                <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                  Thí sinh chỉ thấy trang giới thiệu, đăng ký, bài nộp của mình và kết quả đã công bố.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Tổng contest
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.total}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Trophy className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Bản nháp
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.draft}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Eye className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Đang nhận hồ sơ
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.accepting}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Checks className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Đang diễn ra
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.running}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClockCountdown className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Đã kết thúc
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.ended}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarBlank className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Submissions
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.submissions}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UsersThree className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-card p-10 text-center shadow-card">
          <Trophy className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            Chưa có cuộc thi nào trong khu vực này.
          </p>
          <Button type="button" className="mt-4" onClick={() => navigate("/instructor/contests/new")}>
            Tạo contest đầu tiên
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((contest) => (
            <article
              key={contest.id}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <button
                type="button"
                className="flex flex-1 flex-col p-4 text-left"
                onClick={() => navigate(`/instructor/contests/${contest.id}/manage`)}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {statusLabel(contest.status)}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {contest.status === "draft" ? (
                      <>
                        <EyeSlash className="mr-1 size-3.5" weight="duotone" />
                        Chưa công khai
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 size-3.5" weight="duotone" />
                        Có trang công khai
                      </>
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {locationLabel(contest.location)}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-foreground">
                  {contest.title}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
                  {contest.tagline}
                </p>
                <div className="mt-4 grid gap-2 text-[13px] text-muted-foreground">
                  <div className="rounded-xl border border-border-subtle bg-background px-3 py-2">
                    {formatDateRange(contest.starts_at, contest.ends_at)}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border-subtle bg-background px-3 py-2">
                      {contest.metrics_snapshot.registrations_total} hồ sơ · {contest.metrics_snapshot.approved_registrations} duyệt
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-background px-3 py-2">
                      {contest.metrics_snapshot.submissions_total} submissions · {contest.metrics_snapshot.published_winners} winners
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
                    Xem trang công khai
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/instructor/contests/${contest.id}/manage`)}
                  >
                    Mở khu vực vận hành
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setContestToDelete(contest)}
                >
                  <Trash className="size-4" weight="duotone" />
                  Xoá
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá cuộc thi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {contestToDelete?.title
              ? `Contest "${contestToDelete.title}" cùng toàn bộ hồ sơ đăng ký, lời mời, bài nộp và điểm chấm sẽ bị xoá. Hành động này không thể hoàn tác.`
              : "Cuộc thi và toàn bộ dữ liệu liên quan sẽ bị xoá. Hành động này không thể hoàn tác."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setContestToDelete(null)}
              disabled={deletingId != null}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteContest()}
              disabled={contestToDelete == null || deletingId != null}
            >
              {deletingId != null ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Đang xoá
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="duotone" />
                  Xoá contest
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
