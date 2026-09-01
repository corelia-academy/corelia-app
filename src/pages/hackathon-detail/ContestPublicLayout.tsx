import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Facebook, Globe2, MapPin, Send, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import { publicHackathonDetailQueryOptions } from "@/features/hackathons/hackathonQueries";
import { getMyContestRegistration, registerForContest } from "@/lib/hackathons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { Contest, ContestRegistration } from "@/types/hackathons";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";

const PUBLIC_STATUSES: Contest["status"][] = ["published", "running", "ended"];
const TABS = ["overview", "prizes", "timeline", "resources", "projects"] as const;

export type HackathonOutletContext = {
  contest: Contest;
  registration: ContestRegistration | null;
};

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ContestPublicLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation("contests");
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const options = publicHackathonDetailQueryOptions(slug, locale);
  const contestQuery = useQuery(options);
  const loaded = contestQuery.data;
  const contest = loaded && loaded.slug === slug && PUBLIC_STATUSES.includes(loaded.status) ? loaded : null;
  const registrationQuery = useQuery({
    queryKey: ["hackathons", contest?.id, "my-registration", user?.id ?? "anonymous"],
    queryFn: () => getMyContestRegistration(contest!.id, user),
    enabled: Boolean(contest && user),
    staleTime: 30_000,
  });
  const registration = registrationQuery.data ?? null;
  const [renderedAt] = useState(() => Date.now());
  const registrationClosed = Boolean(
    contest?.registration_deadline && renderedAt > new Date(contest.registration_deadline).getTime(),
  );
  const submissionClosed = Boolean(
    contest?.submission_deadline && renderedAt > new Date(contest.submission_deadline).getTime(),
  );
  const registerMutation = useMutation({
    mutationFn: () => registerForContest(contest!.id, {}),
    onSuccess: async () => {
      toast.success(t("public.registered"));
      await Promise.all([
        registrationQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("public.registerFailed")),
  });
  const translate = useCallback(
    (key: string, values?: Record<string, unknown>) => String(t(key as never, values as never)),
    [t],
  );

  if (contestQuery.isPending) return <ContestDetailLoadingCard translate={translate} />;
  if (contestQuery.error || !contest || !slug) {
    return (
      <PageContainer width="default">
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
          <p className="text-sm font-medium text-foreground">{contestQuery.error ? t("detail.errors.loadFailed") : t("detail.errors.notFound")}</p>
          <Button render={<NavLink to="/hackathons" />} nativeButton={false} variant="outline">{t("detail.errorState.backToList")}</Button>
        </div>
      </PageContainer>
    );
  }

  const cta = registration ? (
    <Button
      type="button"
      disabled={submissionClosed}
      onClick={() => navigate(`/projects/new?hackathon=${encodeURIComponent(slug)}`)}
    >
      {submissionClosed ? t("public.submissionClosed") : t("public.createProject")}
    </Button>
  ) : (
    <Button
      type="button"
      disabled={registrationClosed || registerMutation.isPending}
      onClick={() => {
        if (!user) {
          navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        registerMutation.mutate();
      }}
    >
      {registrationClosed ? t("public.registrationClosed") : t("public.register")}
    </Button>
  );

  return (
    <div className="pb-10">
      <PageContainer width="default" className="pb-0">
        <header className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          <div className="relative aspect-[16/6] min-h-48 overflow-hidden bg-surface-raised">
            {contest.cover_image_url ? <img src={contest.cover_image_url} alt="" className="h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
                <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{t(`public.mode.${contest.mode ?? contest.location}`)}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{t(`public.status.${contest.status}`)}</span>
              </div>
              <h1 className="max-w-4xl text-2xl font-bold sm:text-4xl">{contest.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/85 sm:text-base">{contest.short_description || contest.tagline}</p>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center sm:p-6">
            <div className="grid gap-3 text-sm text-foreground-muted sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-w-0 items-center gap-2">
                {contest.host?.logo_url ? <img src={contest.host.logo_url} alt="" className="size-8 rounded-md object-contain" /> : <Globe2 className="size-5" aria-hidden />}
                <div className="min-w-0"><div className="text-xs">{t("public.hostedBy")}</div>{contest.host?.website_url ? <a href={contest.host.website_url} target="_blank" rel="noreferrer" className="truncate font-medium text-foreground hover:underline">{contest.host.name || "—"}</a> : <div className="truncate font-medium text-foreground">{contest.host?.name || "—"}</div>}</div>
              </div>
              <div className="flex items-center gap-2"><Users className="size-5" aria-hidden /><div><div className="text-xs">{t("public.participants")}</div><div className="font-medium text-foreground">{contest.participants_count ?? 0}</div></div></div>
              <div className="flex items-center gap-2"><CalendarClock className="size-5" aria-hidden /><div><div className="text-xs">{t("public.registrationDeadline")}</div><div className="font-medium text-foreground">{formatDate(contest.registration_deadline, locale)}</div></div></div>
              <div className="flex items-center gap-2"><MapPin className="size-5" aria-hidden /><div><div className="text-xs">{t("public.submissionDeadline")}</div><div className="font-medium text-foreground">{formatDate(contest.submission_deadline, locale)}</div></div></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {contest.social_links?.telegram ? <Button render={<a href={contest.social_links.telegram} target="_blank" rel="noreferrer" aria-label="Telegram" />} nativeButton={false} size="icon" variant="outline"><Send className="size-4" /></Button> : null}
              {contest.social_links?.x ? <Button render={<a href={contest.social_links.x} target="_blank" rel="noreferrer" aria-label="X" />} nativeButton={false} size="icon" variant="outline"><ExternalLink className="size-4" /></Button> : null}
              {contest.social_links?.facebook ? <Button render={<a href={contest.social_links.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" />} nativeButton={false} size="icon" variant="outline"><Facebook className="size-4" /></Button> : null}
              {cta}
            </div>
          </div>
        </header>
      </PageContainer>

      <div className="sticky top-11 z-20 mt-4 border-y border-border-subtle bg-background/95 backdrop-blur">
        <PageContainer width="default" className="overflow-x-auto py-0">
          <nav className="flex min-w-max" aria-label={t("public.tabsLabel")}>
            {TABS.map((tab) => (
              <NavLink
                key={tab}
                to={`/hackathons/${slug}/${tab}`}
                className={({ isActive }) => cn("flex min-h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40", isActive ? "border-primary text-primary" : "border-transparent text-foreground-muted hover:text-foreground")}
              >
                {t(`public.tabs.${tab}`)}
              </NavLink>
            ))}
          </nav>
        </PageContainer>
      </div>

      <PageContainer width="default" className="pt-6">
        <Outlet context={{ contest, registration } satisfies HackathonOutletContext} />
      </PageContainer>
    </div>
  );
}
