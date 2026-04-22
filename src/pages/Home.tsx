import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Chalkboard,
  Medal,
  MonitorPlay,
  Trophy,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import {
  computeProgressPercent,
  getCourse,
  getCourseSections,
  getCourseLessons,
  getLessonProgressForCourse,
  getMyEnrollments,
  getNextLesson,
  getPublishedCourses,
  sortLessonsByCurriculum,
} from "@/lib/courses";
import { listContests } from "@/lib/contests";
import { getHomeDashboardConfig } from "@/lib/dashboardConfig";
import { listOfflineCourses } from "@/lib/offline";
import type { Contest } from "@/types/contests";
import type { HomeDashboardConfig } from "@/types/dashboard";
import type { OfflineCourse } from "@/types/offline";
import type { Course, Enrollment } from "@/types/courses";

type FocusCard = {
  id: string;
  title: string;
  format: "online" | "offline";
  progress: number;
  nextStep: string;
  meta: string;
  action: string;
  thumbnailUrl?: string;
  lastAccessedAt?: string;
};

type PinnedProgramCard = {
  id: string;
  badge: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  meta: string;
};

function formatCourseMeta(
  course: Course,
  format: "online" | "offline",
): string {
  const durationHours =
    course.total_duration_seconds && course.total_duration_seconds > 0
      ? `${Math.max(1, Math.round(course.total_duration_seconds / 3600))} giờ`
      : "tự học";
  return format === "online"
    ? `${durationHours} · ${course.level}`
    : `lớp trực tiếp · ${course.level}`;
}

function pickCourseFormat(course: Course): "online" | "offline" {
  return course.owner_type === "external_partner" ? "offline" : "online";
}

export default function Home() {
  const { profile, user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courseCatalog, setCourseCatalog] = useState<Course[]>([]);
  const [focusCards, setFocusCards] = useState<FocusCard[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [offlineCourses, setOfflineCourses] = useState<OfflineCourse[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState(0);
  const [dashboardConfig, setDashboardConfig] = useState<HomeDashboardConfig | null>(null);

  const needsProfileSetup =
    isAuthenticated &&
    profile != null &&
    (!profile.full_name || !profile.phone);

  const displayName =
    profile?.full_name?.trim() || user?.displayName || "Học viên";
  const firstName = displayName.split(" ")[0] || displayName;
  const email = profile?.email || user?.email || "";
  const avatarUrl = profile?.avatar_url || user?.photoURL || undefined;
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "HV";

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getPublishedCourses().catch(() => [] as Course[]),
      listContests().catch(() => [] as Contest[]),
    ]).then(([publishedCourses, contestList]) => {
      if (cancelled) return;
      setCourseCatalog(publishedCourses);
      setContests(
        contestList.filter(
          (item) => item.status === "published" || item.status === "running",
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [
          enrollments,
          offlineCourseList,
          homeConfig,
        ] =
          await Promise.all(
          [
            getMyEnrollments(user.uid).catch(() => [] as Enrollment[]),
            listOfflineCourses().catch(() => [] as OfflineCourse[]),
            getHomeDashboardConfig().catch(() => null),
          ]);

        const enrollmentCards = await Promise.all<FocusCard | null>(
          enrollments
            .slice(0, 2)
            .map(async (enrollment): Promise<FocusCard | null> => {
              const course = await getCourse(enrollment.course_id);
              if (!course) return null;
              const [lessons, sections] = await Promise.all([
                getCourseLessons(course.id).catch(() => []),
                getCourseSections(course.id).catch(() => []),
              ]);
              const progress = await getLessonProgressForCourse(
                user.uid,
                course.id,
              ).catch(() => []);
              const sortedLessons = sortLessonsByCurriculum(lessons, sections);
              const percent = computeProgressPercent(sortedLessons, progress);
              const nextLesson = getNextLesson(sortedLessons, progress);
              const format = pickCourseFormat(course);
              const card: FocusCard = {
                id: course.id,
                title: course.title,
                format,
                progress: percent,
                nextStep:
                  format === "online"
                    ? nextLesson?.title
                      ? `Bài tiếp theo: ${nextLesson.title}`
                      : "Bạn đã hoàn thành toàn bộ bài học hiện có"
                    : `Lần truy cập gần nhất: ${new Date(enrollment.last_accessed_at).toLocaleDateString("vi-VN")}`,
                meta: formatCourseMeta(course, format),
                action: `/learn/${course.id}`,
                thumbnailUrl: course.thumbnail_url,
                lastAccessedAt: enrollment.last_accessed_at,
              };
              return card;
            }),
        );

        if (!cancelled) {
          setFocusCards(
            enrollmentCards.filter((item): item is FocusCard => item != null),
          );
          setOfflineCourses(offlineCourseList.filter((item) => item.published));
          setIssuedCertificates(
            enrollments.filter((item) => !!item.certificate_issued_at).length,
          );
          setDashboardConfig(homeConfig);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const momentumCards = useMemo(
    () => [
      {
        label: "Đang học",
        value: String(focusCards.length),
        note:
          focusCards.length > 0
            ? `${focusCards.filter((item) => item.format === "online").length} online · ${
                focusCards.filter((item) => item.format === "offline").length
              } offline`
            : "Chưa có khóa nào đang theo dõi",
        icon: MonitorPlay,
      },
      {
        label: "Contest đang mở",
        value: String(contests.length),
        note:
          contests.length > 0
            ? "Hackathon · mini contest · hoạt động hệ sinh thái"
            : "Chưa có contest mới",
        icon: Trophy,
      },
      {
        label: "Chứng chỉ đã cấp",
        value: String(issuedCertificates),
        note:
          issuedCertificates > 0
            ? "Theo dõi toàn bộ trong mục Thành tích"
            : "Chưa có chứng chỉ nào được cấp",
        icon: Medal,
      },
    ],
    [contests.length, focusCards, issuedCertificates],
  );

  const featuredFocus = focusCards[0] ?? null;

  const pinnedPrograms = useMemo<PinnedProgramCard[]>(() => {
    if (!dashboardConfig) return [];

    return dashboardConfig.pinned_programs
      .filter((item) => item.active)
      .map((item) => {
        if (item.type === "course") {
          const enrolledCourse = focusCards.find((entry) => entry.id === item.ref_id);
          const catalogCourse = courseCatalog.find((entry) => entry.id === item.ref_id);
          if (enrolledCourse) {
            return {
              id: item.id,
              badge: item.badge || "Lộ trình online",
              title: item.title_override || enrolledCourse.title,
              description:
                item.description_override ||
                `Ưu tiên cho giai đoạn này của dashboard. ${enrolledCourse.nextStep}`,
              to: `/courses/${enrolledCourse.id}`,
              cta: item.cta_label || "Xem khoá học",
              meta: enrolledCourse.meta,
            };
          }
          if (catalogCourse) {
            return {
              id: item.id,
              badge: item.badge || "Lộ trình online",
              title: item.title_override || catalogCourse.title,
              description:
                item.description_override ||
                catalogCourse.short_description ||
                catalogCourse.description,
              to: `/courses/${catalogCourse.id}`,
              cta: item.cta_label || "Xem khoá học",
              meta: formatCourseMeta(catalogCourse, pickCourseFormat(catalogCourse)),
            };
          }
          return null;
        }

        if (item.type === "contest") {
          const contest = contests.find((entry) => entry.id === item.ref_id);
          if (!contest) return null;
          return {
            id: item.id,
            badge: item.badge || "Sân chơi hệ sinh thái",
            title: item.title_override || contest.title,
            description: item.description_override || contest.tagline,
            to: `/contests/${contest.id}`,
            cta: item.cta_label || "Xem contest",
            meta:
              contest.registration_deadline != null
                ? `Hạn đăng ký ${new Date(contest.registration_deadline).toLocaleDateString("vi-VN")}`
                : "Đang mở trong hệ sinh thái Corelia",
          };
        }

        const offlineCourse = offlineCourses.find((entry) => entry.id === item.ref_id);
        if (!offlineCourse) return null;
        return {
          id: item.id,
          badge: item.badge || "Lớp trực tiếp",
          title: item.title_override || offlineCourse.title,
          description: item.description_override || offlineCourse.tagline,
          to: `/cohorts/${offlineCourse.id}`,
          cta: item.cta_label || "Xem chương trình",
          meta: offlineCourse.venue_city || "Corelia Campus",
        };
      })
      .filter((item): item is PinnedProgramCard => item != null)
      .slice(0, 1);
  }, [contests, courseCatalog, dashboardConfig, focusCards, offlineCourses]);

  const activePinnedProgram = pinnedPrograms[0] ?? null;

  if (!isAuthenticated) {
    const featuredCourses = (courseCatalog ?? []).slice(0, 6);
    return (
      <div className="container-app w-full min-w-0 py-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-card sm:p-6">
              <div className="text-xs text-muted-foreground">Corelia Academy</div>
              <h1 className="mt-2 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                Bắt đầu hành trình học Web3 cùng Corelia
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Khám phá khoá học, chương trình và contest đang mở. Khi cần lưu tiến độ
                hoặc đăng ký, bạn chỉ cần đăng nhập.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button render={<NavLink to="/courses" />} nativeButton={false}>
                  Khám phá khoá học
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  render={<NavLink to="/login" />}
                  nativeButton={false}
                  variant="outline"
                >
                  Đăng nhập
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                  Khoá học nổi bật
                </div>
                <Button
                  render={<NavLink to="/courses" />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="-mr-2"
                >
                  Xem tất cả
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featuredCourses.map((course) => (
                  <NavLink
                    key={course.id}
                    to={`/courses/${course.slug || course.id}`}
                    className="group overflow-hidden rounded-lg border border-border-subtle bg-background transition-colors hover:bg-muted/40"
                  >
                    <div className="relative aspect-video bg-muted/40">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt=""
                          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-2 text-[13px] font-medium leading-5 text-foreground">
                        {course.title}
                      </div>
                      <div className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                        {course.level}
                      </div>
                    </div>
                  </NavLink>
                ))}
              </div>
            </section>

            {contests.length > 0 ? (
              <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">
                    Cuộc thi đang mở
                  </div>
                  <Button
                    render={<NavLink to="/contests" />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    className="-mr-2"
                  >
                    Xem tất cả
                    <ArrowRight className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {contests.slice(0, 3).map((contest) => (
                    <NavLink
                      key={contest.id}
                      to={`/contests/${contest.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-background px-3 py-3 transition-colors hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <div className="line-clamp-1 text-sm font-medium text-foreground">
                          {contest.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                          {contest.tagline}
                        </div>
                        {contest.registration_deadline ? (
                          <div className="mt-2 text-[12px] text-muted-foreground">
                            Hạn đăng ký{" "}
                            {new Date(contest.registration_deadline).toLocaleDateString(
                              "vi-VN",
                            )}
                          </div>
                        ) : null}
                      </div>
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </NavLink>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
              <div className="text-sm font-medium text-foreground">
                Bắt đầu hành trình học tập
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                Đăng nhập để lưu tiến độ, theo dõi chứng chỉ và gửi hồ sơ tham gia contest.
              </p>
              <div className="mt-4 grid gap-2">
                <Button
                  className="w-full"
                  render={<NavLink to="/login" />}
                  nativeButton={false}
                >
                  Đăng nhập
                </Button>
                <Button
                  className="w-full"
                  render={<NavLink to="/courses" />}
                  nativeButton={false}
                  variant="outline"
                >
                  Khám phá khoá học
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
              <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                <Chalkboard className="size-4" weight="duotone" />
                Lối đi nhanh
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: "Tất cả khoá học", to: "/courses" },
                  { label: "Cuộc thi", to: "/contests" },
                  { label: "Lớp học", to: "/cohorts" },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between rounded-md border border-border-subtle bg-background px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <span>{item.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </NavLink>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app w-full min-w-0 py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card sm:p-5">
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">
                {loading ? "Đang đồng bộ..." : "Dashboard"}
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">
                Xin chào, {firstName}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Theo dõi khoá học, contest và thành tích trong một nơi.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {activePinnedProgram ? (
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-border-subtle bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {activePinnedProgram.badge}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                    {activePinnedProgram.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {activePinnedProgram.description}
                  </div>
                </div>
              ) : featuredFocus ? (
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-border-subtle bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {featuredFocus.format === "online" ? "Khoá đang học" : "Lớp đang theo"}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                    {featuredFocus.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {featuredFocus.nextStep}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                      <span>Tiến độ</span>
                      <span>{featuredFocus.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${featuredFocus.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Bắt đầu từ thư viện khoá học
                  </div>
                  <div className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Chọn một khoá học nền tảng để tạo nhịp học tập.
                  </div>
                </div>
              )}

              <div className="flex shrink-0 gap-2">
                <Button
                  render={
                    <NavLink to={activePinnedProgram?.to ?? featuredFocus?.action ?? "/courses"} />
                  }
                  nativeButton={false}
                  size="sm"
                >
                  {activePinnedProgram?.cta ??
                    (featuredFocus ? "Tiếp tục học" : "Khám phá khoá học")}
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  render={<NavLink to="/courses" />}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                >
                  Khoá học
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            {momentumCards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-border-subtle bg-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-foreground">
                        {item.value}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                        {item.note}
                      </div>
                    </div>
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" weight="duotone" />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">Tiếp tục học</div>
              <Button
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="-mr-2"
              >
                Xem tất cả
                <ArrowRight className="size-4" />
              </Button>
            </div>

            {focusCards.length > 0 ? (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {focusCards.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.action}
                    className="min-w-[240px] max-w-[240px] rounded-lg border border-border-subtle bg-background p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="line-clamp-2 text-sm font-medium text-foreground">
                      {item.title}
                    </div>
                    <div className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                      {item.meta}
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                        <span>Tiến độ</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                      {item.nextStep}
                    </div>
                  </NavLink>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-[13px] leading-6 text-muted-foreground">
                Khi bạn ghi danh hoặc mua khoá học đầu tiên, khu vực này sẽ hiện tiến độ và lối vào nhanh.
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">Khám phá</div>
              <Button
                render={<NavLink to="/courses" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="-mr-2"
              >
                Tới thư viện
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(courseCatalog ?? []).slice(0, 4).map((course) => (
                <NavLink
                  key={course.id}
                  to={`/courses/${course.slug || course.id}`}
                  className="group overflow-hidden rounded-lg border border-border-subtle bg-background transition-colors hover:bg-muted/40"
                >
                  <div className="relative aspect-video bg-muted/40">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt=""
                        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-[13px] font-medium leading-5 text-foreground">
                      {course.title}
                    </div>
                    <div className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                      {course.level}
                    </div>
                  </div>
                </NavLink>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          {needsProfileSetup && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-[13px] text-amber-700 dark:text-amber-300">
              <p className="font-medium">
                Hồ sơ của bạn cần bổ sung thêm thông tin.
              </p>
              <p className="mt-1.5 leading-6">
                Hãy cập nhật họ tên và số điện thoại để Corelia, giảng viên hoặc
                học vụ hỗ trợ bạn tốt hơn.
              </p>
              <NavLink
                to="/account"
                className="mt-2.5 inline-flex text-[12px] font-medium underline underline-offset-2"
              >
                Cập nhật tài khoản
              </NavLink>
            </div>
          )}

          <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-foreground">
                  {displayName}
                </div>
                {email ? (
                  <div
                    className="mt-1 truncate text-[13px] text-muted-foreground"
                    title={email}
                  >
                    {email}
                  </div>
                ) : null}
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {profile?.role || "Học viên"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                render={<NavLink to="/account" />}
                nativeButton={false}
                variant="outline"
                className="flex-1"
              >
                Hồ sơ
              </Button>
              <Button
                render={<NavLink to="/achievements" />}
                nativeButton={false}
                className="flex-1"
              >
                Thành tích
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              <Chalkboard className="size-4" weight="duotone" />
              Lối đi nhanh
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: "Tất cả khoá học", to: "/courses" },
                { label: "Cuộc thi", to: "/contests" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-md border border-border-subtle bg-background px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </NavLink>
              ))}
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}
