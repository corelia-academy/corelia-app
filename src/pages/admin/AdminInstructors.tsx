import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { updateProfileAdmin } from "@/lib/profile";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2,
  GraduationCap,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAdminProfiles } from "@/features/admin/users/hooks/useAdminProfiles";
import { useCourseCountsByInstructor } from "@/features/admin/instructors/hooks/useCourseCountsByInstructor";
import { AdminStatsCard } from "@/features/admin/ui/AdminStatsCard";
import { AdminErrorBanner } from "@/features/admin/ui/AdminErrorBanner";

type InstructorOrigin = NonNullable<Profile["instructor_origin"]>;

export default function AdminInstructors() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const { profiles, setProfiles, loading, error, setError, refresh } = useAdminProfiles({
    fallbackErrorMessage: t("instructors.errors.generic"),
  });
  const {
    counts: courseCountByInstructor,
    loading: loadingCourses,
    refresh: refreshCourseCounts,
  } = useCourseCountsByInstructor();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<InstructorOrigin | "all">(
    "all",
  );

  const instructors = useMemo(
    () => profiles.filter((p) => p.role === "instructor"),
    [profiles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructors.filter((p) => {
      if (originFilter !== "all" && (p.instructor_origin ?? null) !== originFilter) {
        return false;
      }
      if (!q) return true;
      const name = (p.full_name ?? "").toLowerCase();
      const email = (p.email ?? "").toLowerCase();
      const org = (p.instructor_organization ?? "").toLowerCase();
      const headline = (p.instructor_headline ?? "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        org.includes(q) ||
        headline.includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [instructors, query, originFilter]);

  const stats = useMemo(() => {
    const total = instructors.length;
    const corelia = instructors.filter(
      (p) => p.instructor_origin === "corelia",
    ).length;
    const external = instructors.filter(
      (p) => p.instructor_origin === "external",
    ).length;
    const totalCourses = Object.values(courseCountByInstructor).reduce(
      (sum, count) => sum + count,
      0,
    );
    return { total, corelia, external, totalCourses, unclassified: total - corelia - external };
  }, [instructors, courseCountByInstructor]);

  async function handleSetOrigin(userId: string, origin: InstructorOrigin) {
    setSavingId(userId);
    setError(null);
    try {
      await updateProfileAdmin(userId, { instructor_origin: origin });
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, instructor_origin: origin } : p)),
      );
      toast.success(t("instructors.toasts.originUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instructors.errors.updateFailed"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatsCard
          label={t("instructors.stats.total")}
          value={stats.total}
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("instructors.stats.corelia")}
          value={stats.corelia}
          icon={<Sparkles className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("instructors.stats.external")}
          value={stats.external}
          icon={<Building2 className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("instructors.stats.unclassified")}
          value={stats.unclassified}
          icon={<Sparkles className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("instructors.stats.managedCourses")}
          value={loadingCourses ? t("instructors.stats.loadingValue") : stats.totalCourses}
          icon={<BookOpen className="size-5" aria-hidden />}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("instructors.hero.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {t("instructors.hero.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[320px]">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("instructors.filters.searchPlaceholder")}
              />
            </div>
            <select
              value={originFilter}
              onChange={(e) =>
                setOriginFilter(e.target.value as InstructorOrigin | "all")
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{t("instructors.filters.originOptions.all")}</option>
              <option value="corelia">{t("instructors.filters.originOptions.corelia")}</option>
              <option value="external">{t("instructors.filters.originOptions.external")}</option>
            </select>
            <Button
              onClick={() => {
                void refresh();
                void refreshCourseCounts();
              }}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("instructors.actions.refresh")}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={originFilter === "all" ? "default" : "outline"}
            onClick={() => setOriginFilter("all")}
          >
            {t("instructors.filters.quick.all")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={originFilter === "corelia" ? "default" : "outline"}
            onClick={() => setOriginFilter("corelia")}
          >
            {t("instructors.filters.quick.corelia")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={originFilter === "external" ? "default" : "outline"}
            onClick={() => setOriginFilter("external")}
          >
            {t("instructors.filters.quick.external")}
          </Button>
          {(query || originFilter !== "all") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setOriginFilter("all");
              }}
            >
              {t("instructors.actions.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card">
        <div className="border-b border-border-subtle bg-muted/35 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {loading
              ? t("instructors.list.syncing")
              : `${t("instructors.list.showing", {
                  shown: filtered.length,
                  total: instructors.length,
                })}${
                  originFilter === "all"
                    ? ""
                    : t("instructors.list.showingOriginSuffix", {
                        origin:
                          originFilter === "corelia"
                            ? t("instructors.filters.originOptions.corelia")
                            : t("instructors.filters.originOptions.external"),
                      })
                }`}
          </p>
        </div>
        <div className="divide-y divide-border-subtle md:hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("instructors.list.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("instructors.list.empty")}
            </div>
          ) : (
            filtered.map((p) => {
              const currentOrigin = p.instructor_origin ?? "external";
              return (
                <article
                  key={p.id}
                  className="space-y-4 p-4"
                  onClick={() => navigate(`/admin/instructors/${p.id}`)}
                >
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt=""
                        className="size-10 rounded-full bg-muted/60 object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-sm font-medium text-muted-foreground">
                        {(p.full_name || "I")[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.full_name || t("instructors.list.notUpdated")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        UID: {p.id.substring(0, 8)}…
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Email
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {p.email ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Phân loại
                      </p>
                      <p className="mt-1">
                        <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                          {p.instructor_origin
                            ? t(`instructors.originLabel.${p.instructor_origin}` as never)
                            : t("instructors.originLabel.unclassified")}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Khoá học
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {loadingCourses ? "..." : courseCountByInstructor[p.id] ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={currentOrigin === "corelia" ? "default" : "outline"}
                      size="sm"
                      disabled={savingId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSetOrigin(p.id, "corelia");
                      }}
                    >
                      {t("instructors.originLabel.corelia")}
                    </Button>
                    <Button
                      type="button"
                      variant={currentOrigin === "external" ? "default" : "outline"}
                      size="sm"
                      disabled={savingId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSetOrigin(p.id, "external");
                      }}
                    >
                      {t("instructors.originLabel.external")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/instructors/${p.id}`);
                      }}
                    >
                      Chi tiết
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Giảng viên
                </th>
                <th className="min-w-[180px] px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phân loại
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Khoá học
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tác vụ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    Đang tải danh sách...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-sm text-muted-foreground"
                  >
                    Chưa có giảng viên nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const currentOrigin = p.instructor_origin ?? "external";
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => navigate(`/admin/instructors/${p.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                              className="size-9 rounded-full bg-muted/60 object-cover"
                            />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-sm font-medium text-muted-foreground">
                              {(p.full_name || "I")[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {p.full_name || t("instructors.list.notUpdated")}
                            </p>
                            <p
                              className="mt-0.5 truncate text-xs text-muted-foreground"
                              title={p.id}
                            >
                              UID: {p.id.substring(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-[180px] px-4 py-3">
                        <span className="block max-w-[260px] truncate text-sm text-foreground">
                          {p.email ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                          {p.instructor_origin
                            ? t(`instructors.originLabel.${p.instructor_origin}` as never)
                            : t("instructors.originLabel.unclassified")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {loadingCourses ? "..." : courseCountByInstructor[p.id] ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant={currentOrigin === "corelia" ? "default" : "outline"}
                            size="sm"
                            disabled={savingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSetOrigin(p.id, "corelia");
                            }}
                          >
                            {t("instructors.originLabel.corelia")}
                          </Button>
                          <Button
                            type="button"
                            variant={currentOrigin === "external" ? "default" : "outline"}
                            size="sm"
                            disabled={savingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSetOrigin(p.id, "external");
                            }}
                          >
                            {t("instructors.originLabel.external")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/instructors/${p.id}`);
                            }}
                          >
                            Chi tiết
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
