import { useMemo, useState } from "react";
import { useAuth } from "@/stores/authStore";
import { updateProfileAdmin } from "@/lib/profile";
import type { UserRole } from "@/types/database";
import { getRoleLabel } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ShieldCheck, User } from "lucide-react";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { useAdminProfiles } from "@/features/admin/users/hooks/useAdminProfiles";
import { AdminStatsCard } from "@/features/admin/ui/AdminStatsCard";
import { AdminErrorBanner } from "@/features/admin/ui/AdminErrorBanner";

export default function AdminUsers() {
  const { t } = useTranslation("admin");
  const { user: currentUser } = useAuth();
  const { profiles, setProfiles, loading, error, refresh } = useAdminProfiles({
    fallbackErrorMessage: t("users.unknownError"),
  });
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  async function handleRoleChange(userId: string, newRole: UserRole) {
    if (
      !confirm(
        t("users.confirmChangeRole", { role: getRoleLabel(newRole) }),
      )
    )
      return;
    try {
      await updateProfileAdmin(userId, { role: newRole });
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p)),
      );
    } catch (err) {
      alert(
        t("users.updateRoleErrorPrefix") +
          (err instanceof Error ? err.message : t("users.unknown")),
      );
    }
  }

  const roleOptions: UserRole[] = [
    "student",
    "instructor",
    "support_staff",
    "admin",
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== "all" && p.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      const name = (p.full_name ?? "").toLowerCase();
      const email =
        (p.id === currentUser?.uid ? (currentUser.email ?? "") : p.email ?? "")
          .toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
      );
    });
  }, [profiles, query, roleFilter, currentUser]);

  const stats = useMemo(() => {
    const total = profiles.length;
    const admins = profiles.filter((p) => p.role === "admin").length;
    const support = profiles.filter((p) => p.role === "support_staff").length;
    const instructors = profiles.filter((p) => p.role === "instructor").length;
    const students = profiles.filter((p) => p.role === "student").length;
    const openCampusConnected = profiles.filter((p) => Boolean(p.ocid)).length;
    return { total, admins, support, instructors, students, openCampusConnected };
  }, [profiles]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatsCard
          label={t("users.stats.totalUsers")}
          value={stats.total}
          icon={<User className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("users.stats.admin")}
          value={stats.admins}
          icon={<ShieldCheck className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("users.stats.opencampusConnected")}
          value={stats.openCampusConnected}
          icon={
            <img
              src="/open-campus-edu-logo.png"
              alt=""
              className="size-5 rounded-full"
              aria-hidden
            />
          }
          iconClassName="flex size-11 items-center justify-center rounded-lg bg-primary/10"
        />
        <AdminStatsCard
          label={t("users.stats.support")}
          value={stats.support}
          icon={<ShieldCheck className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("users.stats.instructor")}
          value={stats.instructors}
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <AdminStatsCard
          label={t("users.stats.student")}
          value={stats.students}
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
      </div>

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("users.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {t("users.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[320px]">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("users.searchPlaceholder")}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{t("users.allRoles")}</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
            <Button
              onClick={() => void refresh()}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("users.refresh")}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={roleFilter === "all" ? "default" : "outline"}
            onClick={() => setRoleFilter("all")}
          >
            {t("users.allRoles")}
          </Button>
          {roleOptions.map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant={roleFilter === role ? "default" : "outline"}
              onClick={() => setRoleFilter(role)}
            >
              {getRoleLabel(role)}
            </Button>
          ))}
          {(query || roleFilter !== "all") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
            >
              {t("users.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card">
        <div className="border-b border-border-subtle bg-muted/35 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {loading
              ? t("users.syncing")
              : t("users.showing", { shown: filtered.length, total: profiles.length }) +
                (roleFilter !== "all"
                  ? t("users.showingRoleSuffix", { role: getRoleLabel(roleFilter) })
                  : "")}
          </p>
        </div>
        <div className="divide-y divide-border-subtle md:hidden">
          {loading ? (
            <div className="space-y-4 p-4">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="space-y-4 rounded-lg border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 rounded-full" />
                      <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16 rounded-full" />
                      <Skeleton className="h-4 w-full rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-16 rounded-full" />
                      <Skeleton className="h-4 w-28 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <User className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("users.empty")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("users.subtitle")}</p>
              </div>
            </div>
          ) : (
            filtered.map((p) => (
              <article key={p.id} className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="size-10 rounded-full bg-muted/60 object-cover"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-sm font-medium text-muted-foreground">
                      {(p.full_name || "U")[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.full_name || t("users.mobile.notUpdated")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t("users.mobile.uid", { uid: p.id.substring(0, 8) })}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("users.mobile.emailLabel")}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {p.id === currentUser?.uid
                        ? currentUser?.email ?? p.email ?? "—"
                        : p.email ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("users.mobile.currentRole")}
                    </p>
                    <p className="mt-1">
                      <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                        {getRoleLabel(p.role)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("users.mobile.phone")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.phone || t("users.mobile.dash")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("users.mobile.createdAt")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString(intlLocale())
                        : t("users.mobile.dash")}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {t("users.mobile.changeRole")}
                  </p>
                  <select
                    value={p.role}
                    onChange={(e) =>
                      void handleRoleChange(p.id, e.target.value as UserRole)
                    }
                    className="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {getRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.name")}
                </th>
                <th className="min-w-[180px] px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.email")}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.role")}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.phone")}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.createdAt")}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("users.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                [0, 1, 2, 3, 4].map((idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="min-w-0 space-y-2">
                          <Skeleton className="h-4 w-40 rounded-full" />
                          <Skeleton className="h-3 w-24 rounded-full" />
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[180px] px-4 py-3">
                      <Skeleton className="h-4 w-48 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-8 w-32 rounded-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10"
                  >
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <User className="size-6 text-muted-foreground" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("users.empty")}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t("users.subtitle")}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/40">
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
                            {(p.full_name || "U")[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {p.full_name || t("users.mobile.notUpdated")}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            title={p.id}
                          >
                            {t("users.mobile.uid", { uid: p.id.substring(0, 8) })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[180px] px-4 py-3">
                      <span
                        className="block max-w-[240px] truncate text-sm text-foreground"
                        title={
                          p.id === currentUser?.uid
                            ? currentUser?.email ?? p.email ?? ""
                            : p.email ?? ""
                        }
                      >
                        {p.id === currentUser?.uid
                          ? currentUser?.email ?? p.email ?? "—"
                          : p.email ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                        {getRoleLabel(p.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString(intlLocale())
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={p.role}
                        onChange={(e) =>
                          void handleRoleChange(p.id, e.target.value as UserRole)
                        }
                        className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {getRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
