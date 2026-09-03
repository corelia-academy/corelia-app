import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { Globe, GraduationCap, Loader2, MapPin } from "lucide-react";
import { publicInstructorDetailQueryOptions } from "@/features/instructor/instructorQueries";
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
import { useTranslation } from "react-i18next";
import { usePageMeta } from "@/hooks/usePageMeta";

const InstructorDetail = () => {
  const { t } = useTranslation("courses");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { id } = useParams<{ id: string }>();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = Boolean(id && UUID_REGEX.test(id.trim()));

  const detailQuery = useQuery(publicInstructorDetailQueryOptions(id, isValidUuid));
  const profile = detailQuery.data?.profile ?? null;
  const courses = detailQuery.data?.courses ?? [];

  const instructorBio =
    profile?.instructor_bio?.trim() || profile?.bio?.trim() || undefined;

  const activeError = !isValidUuid
    ? translate("detail.instructorDetail.errors.notFound")
    : detailQuery.error || (profile && profile.role !== "instructor")
      ? translate("detail.instructorDetail.errors.notFound")
      : null;
  const isActuallyLoading = isValidUuid && detailQuery.isPending;

  usePageMeta({
    title: profile?.full_name?.trim() ?? undefined,
    description: instructorBio,
    image: profile?.avatar_url ?? undefined,
    url: window.location.href,
  });

  if (!id) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5">
          <p className="text-sm font-medium text-destructive">
            {translate("detail.instructorDetail.errors.missingId")}
          </p>
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            {translate("detail.instructorDetail.actions.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  if (isActuallyLoading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface-base p-8 text-center">
          <Loader2 className="size-8 animate-spin text-foreground-muted" aria-hidden />
          <p className="mt-4 text-sm text-foreground-muted">
            {translate("detail.instructorDetail.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (activeError || !profile) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5">
          <p className="text-sm font-medium text-destructive">
            {activeError ?? translate("detail.instructorDetail.errors.notFound")}
          </p>
          <Link
            to="/courses"
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
          >
            {translate("detail.instructorDetail.actions.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  const originLabel = profile.instructor_origin
    ? translate(`detail.instructorDetail.origin.${profile.instructor_origin}`)
    : translate("detail.instructorDetail.origin.unknown");

  const initials =
    profile.full_name?.trim().slice(0, 2).toUpperCase() ||
    profile.username?.[0]?.toUpperCase() ||
    "?";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/">{translate("detail.instructorDetail.crumbs.home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link to="/courses">{translate("detail.instructorDetail.crumbs.courses")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {translate("detail.instructorDetail.crumbs.instructorPrefix")} {profile.full_name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-border-subtle bg-surface-base p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20 rounded-full border border-border-subtle">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-raised px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <GraduationCap className="size-3.5" aria-hidden />
                <span>{originLabel}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {profile.full_name ?? translate("detail.instructorDetail.fallbackName")}
              </h1>
              {profile.instructor_headline ? (
                <p className="text-sm text-foreground-muted">
                  {profile.instructor_headline}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
                {profile.instructor_organization && (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="size-4" aria-hidden />
                    <span>{profile.instructor_organization}</span>
                  </span>
                )}
                {profile.instructor_website && (
                  <a
                    href={profile.instructor_website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Globe className="size-4" aria-hidden />
                    <span>{translate("detail.instructorDetail.websiteLabel")}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {profile.instructor_bio ? (
            <div className="mt-5 border-t border-border-subtle pt-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                {translate("detail.instructorDetail.bioTitle")}
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {profile.instructor_bio}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface-base p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-foreground">
              {translate("detail.instructorDetail.courses.title")}
            </h2>
            <Button
              variant="outline"
              size="sm"
              type="button"
              render={<Link to="/courses" />}
            >
              {translate("detail.instructorDetail.courses.viewAll")}
            </Button>
          </div>
          {courses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
                <GraduationCap className="size-6 text-foreground-subtle" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {translate("detail.instructorDetail.courses.empty")}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.slug || course.id}`}
                  className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card text-foreground transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-surface-raised">
                    <img
                      src={course.thumbnail_url}
                      alt=""
                      className="size-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
                      {course.title}
                    </p>
                    {course.short_description ? (
                      <p className="text-xs text-foreground-muted line-clamp-2">
                        {course.short_description}
                      </p>
                    ) : null}
                    <p className="text-xs text-foreground-muted">
                      {translate("detail.instructorDetail.courses.durationPrefix", {
                        duration: formatDuration(Number(course.total_duration_seconds) || 0),
                      })}
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
