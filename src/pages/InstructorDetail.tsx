import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChalkboardTeacher, Globe, MapPin, Spinner } from "@phosphor-icons/react";
import { getProfile } from "@/lib/profile";
import { getPublishedCoursesByInstructor } from "@/lib/courses";
import type { Profile } from "@/types/database";
import type { Course } from "@/types/courses";
import { getCourseLevelLabel, formatDuration } from "@/types/courses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ORIGIN_LABELS: Record<NonNullable<Profile["instructor_origin"]>, string> = {
  corelia: "Giảng viên Corelia",
  external: "Giảng viên đối tác",
};

const InstructorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([getProfile(id), getPublishedCoursesByInstructor(id)])
      .then(([prof, list]) => {
        if (cancelled) return;
        if (!prof || prof.role !== "instructor") {
          setError("Không tìm thấy hồ sơ giảng viên.");
          return;
        }
        setProfile(prof);
        setCourses(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lỗi tải hồ sơ giảng viên");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">Thiếu mã giảng viên.</p>
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            Quay lại danh sách khoá học
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border-subtle bg-card p-8 text-center shadow-card">
          <Spinner className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            Đang tải hồ sơ giảng viên...
          </p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">
            {error ?? "Không tìm thấy hồ sơ giảng viên."}
          </p>
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            Quay lại danh sách khoá học
          </Link>
        </div>
      </div>
    );
  }

  const originLabel = profile.instructor_origin
    ? ORIGIN_LABELS[profile.instructor_origin]
    : "Giảng viên";

  const initials =
    profile.full_name?.trim().slice(0, 2).toUpperCase() ||
    (profile.email?.[0]?.toUpperCase() ?? "?");

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/courses">Khoá học</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Giảng viên {profile.full_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20 rounded-full border border-border-subtle">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ChalkboardTeacher className="size-3.5" weight="fill" />
                <span>{originLabel}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {profile.full_name ?? "Giảng viên"}
              </h1>
              {profile.instructor_headline ? (
                <p className="text-[14px] text-muted-foreground">
                  {profile.instructor_headline}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                {profile.instructor_organization && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    <span>{profile.instructor_organization}</span>
                  </span>
                )}
                {profile.instructor_website && (
                  <a
                    href={profile.instructor_website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Globe className="size-4" />
                    <span>Website / LinkedIn</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {profile.instructor_bio ? (
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Giới thiệu
              </h2>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
                {profile.instructor_bio}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-foreground">
              Khoá học do giảng viên phụ trách
            </h2>
            <Button
              variant="outline"
              size="sm"
              type="button"
              render={<Link to="/courses" />}
            >
              Xem tất cả khoá học
            </Button>
          </div>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/20 p-5 text-sm text-muted-foreground">
              Giảng viên hiện chưa có khoá học public trên nền tảng.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.slug || course.id}`}
                  className="group overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card transition-[box-shadow,border-color] hover:border-border hover:shadow-elevation-2"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-muted/50">
                    <img
                      src={course.thumbnail_url}
                      alt=""
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1.5">
                    <p className="text-[14px] font-medium leading-snug text-foreground line-clamp-2">
                      {course.title}
                    </p>
                    {course.short_description ? (
                      <p className="text-[12px] text-muted-foreground line-clamp-2">
                        {course.short_description}
                      </p>
                    ) : null}
                    <p className="text-[12px] text-muted-foreground">
                      Thời lượng: {formatDuration(Number(course.total_duration_seconds) || 0)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InstructorDetail;
