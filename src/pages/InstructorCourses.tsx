import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  PencilSimple,
  Spinner,
  Eye,
  EyeSlash,
  PlusCircle,
  CurrencyCircleDollar,
  GraduationCap,
} from "@phosphor-icons/react";
import { getCoursesForManagement } from "@/lib/courses";
import {
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
  formatVndPrice,
} from "@/types/courses";
import type { Course } from "@/types/courses";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

const InstructorCourses = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const canViewAll = isAdmin;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    getCoursesForManagement(profile.id, canViewAll)
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Lỗi tải danh sách");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, canViewAll]);

  const stats = useMemo(() => {
    const published = courses.filter((course) => course.published).length;
    const drafts = courses.length - published;
    const paid = courses.filter((course) => course.access_model === "paid_upfront").length;
    const free = courses.filter((course) => course.access_model === "free").length;
    return { total: courses.length, published, drafts, paid, free };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 animate-spin text-muted-foreground" />
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Tổng khoá học
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.total}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Đã xuất bản
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.published}
              </p>
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
                Bản nháp
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.drafts}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <EyeSlash className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Trả phí upfront
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.paid}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CurrencyCircleDollar className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Khoá học miễn phí
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {stats.free}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border-subtle bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              Danh mục khoá học của bạn
            </h2>
            <p className="mt-1.5 max-w-3xl text-[14px] text-muted-foreground sm:text-[15px]">
              Theo dõi nhanh tình trạng xuất bản, mô hình doanh thu và mở màn chỉnh
              sửa chỉ với một cú nhấp.
            </p>
          </div>
          <Button
            type="button"
            className="inline-flex items-center gap-2"
            onClick={() => navigate("/instructor/courses/new")}
          >
            <PlusCircle className="size-4" weight="duotone" />
            Tạo khoá học mới
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-card p-10 text-center shadow-card">
          <BookOpen className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            Chưa có khoá học nào trong workspace này.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => navigate("/instructor/courses/new")}
          >
            Tạo khoá học đầu tiên
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <button
                type="button"
                className="text-left"
                onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
              >
                <div className="relative aspect-[16/9] overflow-hidden border-b border-border-subtle bg-muted/50">
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
                    <span className="inline-flex items-center rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                      {course.published ? "Đã xuất bản" : "Bản nháp"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground">
                      {getCourseAccessModelLabel(course.access_model)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground">
                      {getCourseOwnerTypeLabel(course.owner_type)}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-lg font-medium tracking-tight text-foreground">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {course.slug}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border-subtle bg-muted/30 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Mô hình giá
                      </p>
                      <p className="mt-1 text-[14px] font-medium text-foreground">
                        {course.access_model === "paid_upfront"
                          ? formatVndPrice(course.price_vnd)
                          : course.access_model === "free_with_paid_certificate"
                            ? `Phí chứng nhận ${formatVndPrice(course.certificate_fee_vnd)}`
                            : "Miễn phí"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-muted/30 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Giảng viên
                      </p>
                      <p className="mt-1 line-clamp-1 text-[14px] font-medium text-foreground">
                        {canViewAll ? course.instructor_name : "Bạn"}
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    window.open(`/courses/${course.slug || course.id}`, "_blank", "noopener");
                  }}
                  title={course.published ? "Xem trang khoá học" : "Xem trước bản nháp"}
                >
                  {course.published ? "Xem khoá học" : "Xem trước"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
                  className="inline-flex items-center gap-1"
                >
                  <PencilSimple className="size-4" />
                  Chỉnh sửa
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorCourses;
