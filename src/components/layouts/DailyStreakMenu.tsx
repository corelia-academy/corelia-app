import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Check,
  Clock,
  Flame,
  Globe,
  Github,
  Infinity as InfinityIcon,
  Link2,
  LoaderCircle,
  LockKeyhole,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  claimDailyStreak,
  getDailyStreakStatus,
  type DailyStreakStatus,
} from "@/lib/dailyStreak";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function formatCountdown(targetIso: string | null, now: number): string {
  if (!targetIso) return "";
  const remaining = Math.max(0, new Date(targetIso).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

function calculateTimelineProgress(streak: number): number {
  if (streak <= 0) return 0;
  if (streak < 3) return (streak / 3) * 20;
  if (streak < 7) return 20 + ((streak - 3) / 4) * 20;
  if (streak < 14) return 40 + ((streak - 7) / 7) * 20;
  if (streak < 30) return 60 + ((streak - 14) / 16) * 20;
  if (streak >= 60) return 100;
  return 80 + ((streak - 30) / 30) * 20;
}

const MILESTONE_STEPS = [
  { days: 0, display: "0" },
  { days: 3, display: "3d" },
  { days: 7, display: "7d" },
  { days: 14, display: "14d" },
  { days: 30, display: "30d" },
  { days: "infinity", display: "∞" },
] as const;

export function DailyStreakMenu({ onConnectOcid }: { onConnectOcid: () => void }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DailyStreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [linkingGithub, setLinkingGithub] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bursting, setBursting] = useState(false);
  const [questTab, setQuestTab] = useState<"daily" | "external">("daily");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getDailyStreakStatus());
    } catch (error) {
      console.error("[DailyStreakMenu] status", error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  useEffect(() => {
    // Initial fetch on mount for header counter
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!status?.nextClaimAt) return;
    const target = new Date(status.nextClaimAt).getTime();
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= target) {
        window.clearInterval(id);
        void refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [refresh, status?.nextClaimAt]);

  const countdown = useMemo(
    () => formatCountdown(status?.nextClaimAt ?? null, now),
    [now, status?.nextClaimAt],
  );
  const displayedStreak = status?.currentStreak ?? 0;
  const timelineProgress = useMemo(() => calculateTimelineProgress(displayedStreak), [displayedStreak]);

  const streakSubtext = useMemo(() => {
    if (!status) return "";
    if (status.longestStreak === 0) {
      return t("dailyStreak.zeroStreakMotivation");
    }
    if (status.currentStreak === 0 && status.longestStreak > 0) {
      return t("dailyStreak.brokenStreakMotivation", { count: status.longestStreak });
    }
    if (status.currentStreak >= status.longestStreak) {
      return t("dailyStreak.peakStreakMotivation", { count: status.currentStreak });
    }
    const remaining = Math.max(1, status.longestStreak - status.currentStreak);
    return t("dailyStreak.activeStreakMotivation", {
      remaining,
      longest: status.longestStreak,
    });
  }, [status, t]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const next = await claimDailyStreak();
      setStatus(next);
      if (next.claimed) {
        setBursting(true);
        window.setTimeout(() => setBursting(false), 850);
        toast.success(t("dailyStreak.claimedToast", { count: next.currentStreak }));
        if (next.newMilestones.length > 0) {
          toast.success(t("dailyStreak.milestoneToast", { days: next.newMilestones.join(", ") }));
        }
      }
    } catch (error) {
      console.error("[DailyStreakMenu] claim", error);
      toast.error(t("dailyStreak.claimFailed"));
    } finally {
      setClaiming(false);
    }
  }

  async function handleConnectGithub() {
    setLinkingGithub(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error) {
      console.error("[DailyStreakMenu] link GitHub", error);
      toast.error(t("dailyStreak.githubConnectFailed"));
      setLinkingGithub(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-subtle bg-surface-base px-3 text-xs font-semibold tabular-nums text-foreground shadow-xs transition-all duration-150 hover:border-primary/40 hover:bg-surface-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:h-10 md:px-3.5 md:text-sm"
            aria-label={t("dailyStreak.openAria", { count: displayedStreak })}
          >
            <Flame className="size-4 fill-primary/30 text-primary md:size-[18px]" aria-hidden />
            <span className="font-mono font-bold">{displayedStreak}</span>
          </button>
        }
      />
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:!w-[520px] md:!w-[560px] lg:!w-[580px] sm:!max-w-[580px] p-0 overflow-hidden flex flex-col border-l border-border-subtle bg-surface-base text-foreground shadow-2xl"
      >
        {/* Sheet Top Header */}
        <SheetHeader className="border-b border-border-subtle bg-gradient-to-b from-primary-muted/20 to-transparent p-4 sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary-muted/40 text-primary">
                  <Flame className="size-4 fill-primary/30" aria-hidden />
                </div>
                <SheetTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  {t("dailyStreak.title")}
                </SheetTitle>
              </div>
              <SheetDescription className="mt-1 text-xs leading-relaxed text-foreground-muted">
                {t("dailyStreak.subtitle")}
              </SheetDescription>
            </div>
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary-muted/25 px-2.5 sm:px-3 py-1 text-xs font-mono font-bold text-primary shadow-xs">
              <Sparkles className="size-3.5" aria-hidden />
              <span>{t("dailyStreak.points", { count: status?.totalPoints ?? 0 })}</span>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Sheet Content Body with hidden scrollbar */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
          {loading ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-3">
                <Skeleton className="size-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <div className="space-y-2 pt-3">
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ) : !status ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-xs">
                <AlertCircle className="size-7" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {t("dailyStreak.loadFailed")}
              </p>
              <p className="mt-1.5 text-xs text-foreground-muted max-w-[280px]">
                {t("dailyStreak.claimFailed")}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-5 gap-2 rounded-xl text-xs font-medium px-4"
                onClick={() => void refresh()}
              >
                <RotateCw className="size-3.5" aria-hidden />
                {t("dailyStreak.retry")}
              </Button>
            </div>
          ) : (
            <>
              {/* Center Streak Showcase */}
              <div className="flex flex-col items-center text-center py-1">
                <div
                  className={cn(
                    "relative flex size-20 sm:size-22 items-center justify-center rounded-full border-2 border-primary/25 bg-gradient-to-b from-primary-muted/40 to-primary-muted/10 text-primary shadow-md transition-transform duration-300",
                    bursting && "motion-safe:animate-[streak-flame-burst_850ms_cubic-bezier(0.16,1,0.3,1)]",
                  )}
                >
                  <Flame className="size-10 sm:size-11 fill-primary/35" aria-hidden />
                </div>
                <div className="mt-2.5 font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {status.currentStreak}
                </div>
                <p className="mt-0.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                  {t("dailyStreak.currentStreak")}
                </p>
              </div>

              {/* Claim Action CTA */}
              <div className="flex flex-col items-center justify-center">
                {status.canClaim ? (
                  <Button
                    type="button"
                    size="lg"
                    className="h-[46px] min-w-[180px] w-auto max-w-full px-6 gap-2 rounded-full font-bold shadow-md transition-all active:scale-[0.97] text-sm whitespace-nowrap"
                    disabled={claiming}
                    onClick={() => void handleClaim()}
                  >
                    {claiming ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-4" aria-hidden />
                    )}
                    <span>{t("dailyStreak.claim")}</span>
                  </Button>
                ) : (
                  <div className="flex flex-col items-center w-full space-y-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled
                      className="h-[46px] min-w-[180px] w-auto max-w-full px-6 gap-2 rounded-full font-bold opacity-90 cursor-default text-sm whitespace-nowrap"
                    >
                      <Check className="size-4 text-primary shrink-0" aria-hidden />
                      <span>{t("dailyStreak.claimed")}</span>
                    </Button>
                    {countdown ? (
                      <div className="flex items-center justify-center gap-1.5 text-center font-mono text-xs text-foreground-muted pt-0.5">
                        <Clock className="size-3.5 text-foreground-subtle" aria-hidden />
                        <span>{t("dailyStreak.nextClaimIn", { countdown })}</span>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-foreground-muted">
                        {t("dailyStreak.claimHint")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Stepper Timeline Progress Card with Infinity Node and Upward Pointer */}
              <div className="rounded-2xl border border-border-subtle bg-surface-raised/40 p-3.5 sm:p-4 shadow-xs">
                <div className="relative pb-4 px-3 pt-1.5">
                  {/* Background Track Line */}
                  <div className="absolute left-[28px] right-[28px] top-[19px] h-1 -translate-y-1/2 rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
                      style={{ width: `${timelineProgress}%` }}
                    />
                  </div>

                  {/* 6 Milestone Nodes on the Track (0 -> 3d -> 7d -> 14d -> 30d -> ∞) */}
                  <div className="relative flex items-center justify-between">
                    {MILESTONE_STEPS.map((m) => {
                      const isStart = m.days === 0;
                      const isInfinity = m.days === "infinity";
                      const unlocked = isStart
                        ? status.currentStreak >= 0
                        : isInfinity
                        ? status.currentStreak >= 30
                        : status.unlockedMilestones.includes(m.days) || status.currentStreak >= m.days;

                      const milestoneTitle = isStart
                        ? t("dailyStreak.startMilestone")
                        : isInfinity
                        ? t("dailyStreak.infinityMilestone")
                        : t("dailyStreak.milestone", { days: m.days });

                      return (
                        <div
                          key={String(m.days)}
                          className="relative z-10 flex w-8 flex-col items-center gap-1.5 text-center"
                        >
                          <span
                            className={cn(
                              "flex size-6.5 items-center justify-center rounded-full border text-xs transition-all duration-200 shadow-xs ring-3 ring-surface-base",
                              unlocked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border-subtle bg-surface-base text-foreground-subtle",
                            )}
                            title={milestoneTitle}
                          >
                            {isInfinity ? (
                              <InfinityIcon
                                className={cn(
                                  "size-3.5 sm:size-4",
                                  unlocked ? "text-primary-foreground stroke-[2.5]" : "text-foreground-subtle stroke-[2.2]",
                                )}
                                aria-hidden
                              />
                            ) : isStart ? (
                              <Flame className="size-3 fill-current" aria-hidden />
                            ) : unlocked ? (
                              <Flame className="size-3 fill-current" aria-hidden />
                            ) : (
                              <LockKeyhole className="size-3" aria-hidden />
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-mono transition-colors",
                              isInfinity
                                ? "text-sm sm:text-base font-bold leading-none -mt-0.5"
                                : "text-[10px] sm:text-[11px] font-medium tabular-nums",
                              unlocked ? "text-primary font-bold" : "text-foreground-muted",
                            )}
                          >
                            {m.display}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Subtext: Record or Dynamic Motivation */}
                <p className="mt-1 text-center text-xs text-foreground-muted border-t border-border-subtle/50 pt-2.5 leading-relaxed">
                  {streakSubtext}
                </p>
              </div>

              {/* Quest Section with Animated Underline Tab Switcher */}
              <div className="space-y-3 pt-1">
                <div className="relative flex border-b border-border-subtle/70">
                  <button
                    type="button"
                    className={cn(
                      "relative flex-1 pb-2.5 pt-1.5 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 rounded-t-lg hover:text-primary hover:bg-primary-muted/15",
                      questTab === "daily"
                        ? "text-primary font-bold"
                        : "text-foreground-muted",
                    )}
                    onClick={() => setQuestTab("daily")}
                  >
                    <Flame className={cn("size-3.5 transition-colors", questTab === "daily" ? "text-primary fill-primary/30" : "text-foreground-muted")} aria-hidden />
                    <span>{t("dailyStreak.dailyQuests")}</span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "relative flex-1 pb-2.5 pt-1.5 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 rounded-t-lg hover:text-primary hover:bg-primary-muted/15",
                      questTab === "external"
                        ? "text-primary font-bold"
                        : "text-foreground-muted",
                    )}
                    onClick={() => setQuestTab("external")}
                  >
                    <Globe className={cn("size-3.5 transition-colors", questTab === "external" ? "text-primary fill-primary/30" : "text-foreground-muted")} aria-hidden />
                    <span>{t("dailyStreak.externalQuests")}</span>
                  </button>

                  {/* Smooth Sliding Underline */}
                  <span
                    className="absolute -bottom-px h-[2px] w-1/2 bg-primary rounded-full transition-transform duration-300 ease-out"
                    style={{
                      transform: questTab === "daily" ? "translateX(0%)" : "translateX(100%)",
                    }}
                    aria-hidden
                  />
                </div>

                {/* Tab Content */}
                <div className="space-y-2">
                  {questTab === "daily" ? (
                    <BonusTaskRow
                      icon={<Flame className="size-3.5 text-primary" aria-hidden />}
                      label={t("dailyStreak.dailyBonus")}
                      points="+1"
                      complete={!status.canClaim}
                    />
                  ) : (
                    <>
                      <BonusTaskRow
                        icon={<Link2 className="size-3.5 text-foreground-muted" aria-hidden />}
                        label={t("dailyStreak.ocidBonus")}
                        points="+50"
                        complete={status.ocidConnected}
                        action={
                          !status.ocidConnected ? (
                            <button
                              type="button"
                              className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 active:scale-95"
                              onClick={() => {
                                setOpen(false);
                                onConnectOcid();
                              }}
                            >
                              {t("dailyStreak.connect")}
                            </button>
                          ) : null
                        }
                      />
                      <BonusTaskRow
                        icon={<Github className="size-3.5 text-foreground-muted" aria-hidden />}
                        label={t("dailyStreak.githubBonus")}
                        points="+50"
                        complete={status.githubConnected}
                        action={
                          !status.githubConnected ? (
                            <button
                              type="button"
                              className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 active:scale-95 disabled:opacity-60"
                              disabled={linkingGithub}
                              onClick={() => void handleConnectGithub()}
                            >
                              {linkingGithub ? t("dailyStreak.connecting") : t("dailyStreak.connect")}
                            </button>
                          ) : null
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BonusTaskRow({
  icon,
  label,
  points,
  complete,
  action,
}: {
  icon: ReactNode;
  label: string;
  points: string;
  complete: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-3 text-sm shadow-xs transition-colors",
        complete ? "bg-surface-base/30 opacity-75" : "hover:bg-surface-raised/80",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            complete
              ? "bg-surface-overlay text-foreground-muted"
              : "bg-surface-overlay text-foreground-muted",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "truncate text-xs font-medium text-foreground",
            complete && "text-foreground-muted line-through",
          )}
        >
          {label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {complete ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary border border-primary/20">
            <Check className="size-3.5 stroke-[2.5]" aria-hidden />
          </span>
        ) : (
          <>
            <span className="font-mono text-xs font-bold text-primary">{points}</span>
            {action}
          </>
        )}
      </div>
    </div>
  );
}
