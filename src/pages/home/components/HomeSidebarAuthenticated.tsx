import { ArrowRight, BookOpen } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function HomeSidebarAuthenticated({
  t,
  avatarUrl,
  displayName,
  initials,
  email,
  role,
}: {
  t: TFunction<"common">;
  avatarUrl?: string;
  displayName: string;
  initials: string;
  email: string;
  role: string | null;
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
      <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
        <div className="flex items-start gap-3">
          <Avatar size="lg" className="shrink-0">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              {displayName}
            </div>
            {email ? (
              <div
                className="mt-1 truncate text-sm text-foreground-muted"
                title={email}
              >
                {email}
              </div>
            ) : null}
            <div className="mt-1 text-xs text-foreground-muted">
              {role
                ? i18n.t(`auth:roles.${role}`, { defaultValue: role })
                : t("home.studentFallback")}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <NavLink
            to="/account"
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-surface-overlay hover:text-foreground",
            )}
          >
            {t("nav.account")}
          </NavLink>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-surface-base p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          <BookOpen className="size-4 shrink-0" aria-hidden />
          {t("home.guest.quickLinksTitle")}
        </div>
        <div className="mt-4 space-y-2">
          {[
            { label: t("home.allCourses"), to: "/courses" },
            { label: t("nav.contests"), to: "/hackathons" },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-base px-3 py-3 text-sm text-foreground transition-all duration-200 ease-out hover:bg-surface-raised hover:-translate-y-0.5 hover:border-border"
            >
              <span>{item.label}</span>
              <ArrowRight className="size-4 text-foreground-muted" />
            </NavLink>
          ))}
        </div>
      </section>
    </aside>
  );
}
