import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

export function ContestPublicFinalCtaSection() {
  const vm = useContestDetailVm();
  const { contest, translate, navigate, publicCta } = vm;
  if (vm.isManageView) return null;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <Card id="final-cta" className="scroll-mt-36 border-primary/20 bg-primary/5">
      <CardContent className="p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
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
      </CardContent>
    </Card>
  );
}
