import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";
import { cn } from "@/lib/utils";

export function ContestPublicFinalCtaSection() {
  const vm = useContestDetailVm();
  const { contest, translate, navigate, publicCta } = vm;
  if (vm.isManageView) return null;

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <section
      id="final-cta"
      className={cn(
        "scroll-mt-36 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/25 via-primary/10 to-surface-raised px-6 py-10 text-center",
      )}
    >
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {translate("detail.finalCta.title")}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
        {translate("detail.finalCta.description")}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {publicCta ? (
          <Button
            type="button"
            className="min-h-11 min-w-[200px]"
            variant={publicCta.variant}
            disabled={Boolean(publicCta.disabled)}
            onClick={() => navigate(publicCta.navigateTo)}
          >
            {publicCta.label}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2"
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl).then(
              () => toast.success(translate("detail.hero.shareCopied")),
              () => toast.error(translate("detail.hero.shareCopyFailed")),
            );
          }}
        >
          <Share2 className="size-4" aria-hidden />
          {translate("detail.hero.shareCopyLink")}
        </Button>
      </div>
      <p className="mt-4 text-xs text-foreground-muted">{contest.title}</p>
    </section>
  );
}
