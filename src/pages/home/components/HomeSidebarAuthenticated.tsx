import { ArrowRight, BookOpen } from "lucide-react";
import { NavLink } from "react-router";
import type { TFunction } from "i18next";
import i18n from "@/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{displayName}</div>
            {email ? (
              <div className="mt-1 truncate text-sm text-muted-foreground" title={email}>
                {email}
              </div>
            ) : null}
            <div className="mt-1 text-xs text-muted-foreground">
              {role
                ? i18n.t(`auth:roles.${role}`, { defaultValue: role })
                : t("home.studentFallback")}
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
            {t("nav.account")}
          </Button>
          <Button
            render={<NavLink to="/achievements" />}
            nativeButton={false}
            variant="secondary"
            className="flex-1"
          >
            {t("nav.achievements")}
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <BookOpen className="size-4 shrink-0" aria-hidden />
          {t("home.guest.quickLinksTitle")}
        </div>
        <div className="mt-4 space-y-2">
          {[
            { label: t("home.allCourses"), to: "/courses" },
            { label: t("nav.contests"), to: "/contests" },
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
  );
}

