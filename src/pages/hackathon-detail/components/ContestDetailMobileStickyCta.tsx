import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";
import { cn } from "@/lib/utils";

export function ContestDetailMobileStickyCta() {
  const vm = useContestDetailVm();
  const { navigate, publicCta, publicHeroCountdown } = vm;
  const [finalVisible, setFinalVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("final-cta");
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setFinalVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (vm.isManageView || !publicCta || finalVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
      )}
      style={{ height: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
        <div
          className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-muted tabular-nums"
          aria-live="polite"
        >
          {publicHeroCountdown?.text ?? "\u00a0"}
        </div>
        <Button
          type="button"
          className="min-h-11 shrink-0 px-4"
          variant={publicCta.variant}
          disabled={Boolean(publicCta.disabled)}
          onClick={() => navigate(publicCta.navigateTo)}
        >
          <span className="max-w-[10rem] truncate">{publicCta.label}</span>
        </Button>
      </div>
    </div>
  );
}
