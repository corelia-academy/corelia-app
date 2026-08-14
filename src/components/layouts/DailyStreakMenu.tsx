import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Flame, Github, Link2, LoaderCircle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  claimDailyStreak,
  getDailyStreakStatus,
  STREAK_MILESTONES,
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

export function DailyStreakMenu({ onConnectOcid }: { onConnectOcid: () => void }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DailyStreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [linkingGithub, setLinkingGithub] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bursting, setBursting] = useState(false);

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
    void refresh();
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
  const progress = Math.min(100, (displayedStreak / STREAK_MILESTONES.at(-1)!) * 100);

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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface-base px-2.5 text-sm font-semibold tabular-nums text-foreground transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label={t("dailyStreak.openAria", { count: displayedStreak })}
          >
            <Flame className="size-[19px] fill-primary/20 text-primary" aria-hidden />
            <span>{displayedStreak}</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="border-b border-border bg-primary-muted/45 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("dailyStreak.title")}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">{t("dailyStreak.subtitle")}</p>
            </div>
            <div className="rounded-full bg-surface-base px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-card">
              {t("dailyStreak.points", { count: status?.totalPoints ?? 0 })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-foreground-muted">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
            {t("status.loading")}
          </div>
        ) : !status ? (
          <div className="space-y-3 p-4 text-sm text-foreground-muted">
            <p>{t("dailyStreak.loadFailed")}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              {t("dailyStreak.retry")}
            </Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "flex size-20 items-center justify-center rounded-full bg-primary-muted text-primary",
                  bursting && "motion-safe:animate-[streak-flame-burst_850ms_cubic-bezier(0.16,1,0.3,1)]",
                )}
              >
                <Flame className="size-11 fill-primary/25" aria-hidden />
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {status.currentStreak}
              </div>
              <p className="text-xs text-foreground-muted">{t("dailyStreak.currentStreak")}</p>
            </div>

            <div className="mt-5">
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {STREAK_MILESTONES.map((days) => {
                  const unlocked = status.unlockedMilestones.includes(days);
                  return (
                    <div key={days} className="flex flex-col items-center gap-1 text-center">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border",
                          unlocked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface-base text-foreground-subtle",
                        )}
                        title={t("dailyStreak.milestone", { days })}
                      >
                        {unlocked ? <Flame className="size-4 fill-current" aria-hidden /> : <LockKeyhole className="size-3.5" aria-hidden />}
                      </span>
                      <span className="text-[11px] font-medium tabular-nums text-foreground-muted">{days}d</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-xs text-foreground-muted">
                {t("dailyStreak.longest", { count: status.longestStreak })}
              </p>
            </div>

            <Button
              type="button"
              className="mt-5 min-h-11 w-full bg-black text-white hover:bg-black/85 disabled:bg-black/70 disabled:text-white/70"
              disabled={!status.canClaim || claiming}
              onClick={() => void handleClaim()}
            >
              {claiming ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              {status.canClaim ? t("dailyStreak.claim") : t("dailyStreak.claimed")}
            </Button>
            {!status.canClaim && countdown ? (
              <p className="mt-2 text-center text-xs text-foreground-muted">
                {t("dailyStreak.nextClaimIn", { countdown })}
              </p>
            ) : (
              <p className="mt-2 text-center text-xs text-foreground-muted">
                {t("dailyStreak.claimHint")}
              </p>
            )}

            <div className="mt-5 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("dailyStreak.bonusTasks")}</p>
              <BonusTask
                icon={<Check className="size-4" aria-hidden />}
                label={t("dailyStreak.dailyBonus")}
                points="+1"
                complete={!status.canClaim}
              />
              <BonusTask
                icon={<Link2 className="size-4" aria-hidden />}
                label={t("dailyStreak.ocidBonus")}
                points="+50"
                complete={status.ocidConnected}
                action={!status.ocidConnected ? (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={onConnectOcid}>
                    {t("dailyStreak.connect")}
                  </button>
                ) : null}
              />
              <BonusTask
                icon={<Github className="size-4" aria-hidden />}
                label={t("dailyStreak.githubBonus")}
                points="+50"
                complete={status.githubConnected}
                action={!status.githubConnected ? (
                  <button type="button" className="text-xs font-medium text-primary hover:underline disabled:opacity-60" disabled={linkingGithub} onClick={() => void handleConnectGithub()}>
                    {linkingGithub ? t("dailyStreak.connecting") : t("dailyStreak.connect")}
                  </button>
                ) : null}
              />
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BonusTask({
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
    <div className="mt-3 flex items-center gap-2.5 text-sm">
      <span className={cn("flex size-7 items-center justify-center rounded-full", complete ? "bg-primary-muted text-primary" : "bg-surface-overlay text-foreground-muted")}>
        {complete ? <Check className="size-4" aria-hidden /> : icon}
      </span>
      <span className={cn("min-w-0 flex-1", complete && "text-foreground-muted line-through")}>{label}</span>
      <span className="text-xs font-semibold tabular-nums text-primary">{points}</span>
      {action}
    </div>
  );
}
