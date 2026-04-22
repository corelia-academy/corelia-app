import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listOfflineCohorts, listOfflineCourses } from "@/lib/offline";
import { useAuth } from "@/stores/authStore";
import type { OfflineCohort, OfflineCourse } from "@/types/offline";

export default function InstructorCohorts() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [items, setItems] = useState<OfflineCourse[]>([]);
  const [cohorts, setCohorts] = useState<OfflineCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOfflineCourses(), listOfflineCohorts()])
      .then(([courseRows, cohortRows]) => {
        const nextCohorts =
          profile?.role === "instructor"
            ? cohortRows.filter(
                (item) =>
                  item.instructor_id === profile.id ||
                  (item.coordinator_ids ?? []).includes(profile.id),
              )
            : cohortRows;
        const nextCourses = courseRows.filter((course) =>
          nextCohorts.some((cohort) => cohort.offline_course_id === course.id),
        );
        if (!cancelled) {
          setItems(nextCourses);
          setCohorts(nextCohorts);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể tải lớp học.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  const stats = useMemo(
    () => ({
      total: items.length,
      running: cohorts.filter((item) => item.status === "running").length,
      students: cohorts.reduce(
        (total, item) => total + item.metrics_snapshot.enrolled_students,
        0,
      ),
      recordings: cohorts.reduce(
        (total, item) => total + item.metrics_snapshot.published_recordings,
        0,
      ),
    }),
    [cohorts, items],
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Workspace lớp trực tiếp
            </div>
            <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground">
              Quản lý khoá học offline
            </h1>
            <p className="mt-1.5 max-w-3xl text-[15px] text-muted-foreground">
              Quản lý khoá học trực tiếp ở tầng sản phẩm, sau đó đi vào từng cohort để
              vận hành lịch học, recording và roadmap học viên.
            </p>
          </div>
          <Button type="button" onClick={() => navigate("/instructor/cohorts/new")}>
            Tạo lớp học mới
          </Button>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Tổng khoá
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Cohort đang vận hành
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{stats.running}</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Học viên active
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{stats.students}</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Recording sẵn sàng
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{stats.recordings}</div>
        </div>
      </div>

      {loading ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-muted-foreground">
            Đang tải workspace lớp học...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="mt-6 border-destructive/20 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <div className="text-[15px] font-medium text-foreground">
              Chưa có cohort nào trong workspace này.
            </div>
            <Button
              type="button"
              className="mt-4"
              onClick={() => navigate("/instructor/cohorts/new")}
            >
              Tạo cohort đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((course) => {
            const courseCohorts = cohorts.filter(
              (cohort) => cohort.offline_course_id === course.id,
            );
            return (
            <article
              key={course.id}
              className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card"
            >
              <div className="border-b border-border-subtle bg-muted/20 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {course.published ? "Đã mở" : "Bản nháp"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {course.level}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-medium text-foreground">{course.title}</h2>
                <p className="mt-1.5 text-[14px] text-muted-foreground">{course.tagline}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Cohorts
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-foreground">
                      {course.metrics_snapshot.cohorts_total || courseCohorts.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Học viên
                    </div>
                    <div className="mt-1.5 text-lg font-semibold text-foreground">
                      {course.metrics_snapshot.enrolled_students}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/cohorts/${course.id}`)}
                  >
                    Xem public
                  </Button>
                  <Button
                    type="button"
                    onClick={() => navigate(`/instructor/cohorts/${course.id}/manage`)}
                  >
                    Mở workspace
                  </Button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
