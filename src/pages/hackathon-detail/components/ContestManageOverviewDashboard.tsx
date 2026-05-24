import type { ComponentType } from "react";
import { useNavigate } from "react-router";
import {
  ClipboardCheck,
  ExternalLink,
  Gavel,
  Mail,
  Megaphone,
  Settings as SettingsIcon,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContestManageMetricsTiles } from "@/pages/hackathon-detail/components/ContestManageMetricsTiles";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type Action = {
  key: string;
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Optional numeric badge (e.g. pending applications count). */
  count?: number | null;
  /** External link (full page navigation) — defaults to internal router. */
  external?: boolean;
};

function ActionCard({
  action,
  onNavigate,
  translate,
}: {
  action: Action;
  onNavigate: (href: string) => void;
  translate: Translate;
}) {
  const Icon = action.icon;
  const showCount = typeof action.count === "number" && action.count > 0;
  return (
    <button
      type="button"
      onClick={() => onNavigate(action.href)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-left transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
      )}
      aria-label={action.title}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        {showCount ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
            {action.count}
          </span>
        ) : action.external ? (
          <ExternalLink
            className="size-4 shrink-0 text-foreground-muted"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-semibold text-foreground">
          {action.title}
        </div>
        {action.description ? (
          <p className="text-xs leading-relaxed text-foreground-muted">
            {action.description}
          </p>
        ) : null}
      </div>
      {showCount ? (
        <span className="text-xs font-medium text-primary">
          {translate("workspace.manage.dashboard.viewAction")}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Manage Overview tab body: replaces the previous read-only description / rules / operating
 * model duplication (which already lives on the public page) with metrics tiles + role-aware
 * quick actions. Inside the workspace, the user expects edit + operate, not viewing.
 */
export function ContestManageOverviewDashboard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    contest,
    translate,
    canReview,
    canJudge,
    isManager,
    registrations,
  } = vm;
  const navigate = useNavigate();

  const pendingApplications = registrations.filter(
    (r) => r.status === "pending",
  ).length;

  const m = contest.metrics_snapshot;
  const pendingSubmissions = Math.max(
    0,
    Number(m.submissions_total ?? 0) - Number(m.scored_submissions ?? 0),
  );

  const slug = contest.slug?.trim() ?? "";
  const manageBase = slug ? `/hackathons/${slug}/manage` : "/hackathons/manage";
  const publicHref = slug ? `/hackathons/${slug}` : "/hackathons";

  const actions: Action[] = [];

  if (canReview) {
    actions.push({
      key: "applications",
      title: translate("workspace.manage.dashboard.reviewApplicationsTitle"),
      description: translate(
        "workspace.manage.dashboard.reviewApplicationsDescription",
      ),
      href: `${manageBase}/applications`,
      icon: ClipboardCheck,
      count: pendingApplications,
    });
  }
  if (canJudge) {
    actions.push({
      key: "judging",
      title: translate("workspace.manage.dashboard.scoreSubmissionsTitle"),
      description: translate(
        "workspace.manage.dashboard.scoreSubmissionsDescription",
      ),
      href: `${manageBase}/judging`,
      icon: Gavel,
      count: pendingSubmissions,
    });
  }
  if (isManager) {
    actions.push({
      key: "settings",
      title: translate("workspace.manage.dashboard.editHackathonTitle"),
      description: translate(
        "workspace.manage.dashboard.editHackathonDescription",
      ),
      href: `${manageBase}/settings`,
      icon: SettingsIcon,
    });
    actions.push({
      key: "email",
      title: translate("workspace.manage.dashboard.announceTitle"),
      description: translate("workspace.manage.dashboard.announceDescription"),
      href: `${manageBase}/email`,
      icon: Mail,
    });
    actions.push({
      key: "awards",
      title: translate("workspace.manage.dashboard.awardsTitle"),
      description: translate("workspace.manage.dashboard.awardsDescription"),
      href: `${manageBase}/awards`,
      icon: Trophy,
    });
  }
  actions.push({
    key: "public",
    title: translate("workspace.manage.dashboard.viewPublicTitle"),
    description: translate("workspace.manage.dashboard.viewPublicDescription"),
    href: publicHref,
    icon: Megaphone,
    external: true,
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <ContestManageMetricsTiles contest={contest} translate={translate} />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {translate("workspace.manage.dashboard.actionsTitle")}
            </h2>
            <p className="text-sm text-foreground-muted">
              {translate("workspace.manage.dashboard.actionsDescription")}
            </p>
          </header>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <ActionCard
                key={action.key}
                action={action}
                onNavigate={navigate}
                translate={translate}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
