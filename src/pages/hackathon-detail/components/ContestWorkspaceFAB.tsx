import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { cn } from "@/lib/utils";

export function ContestWorkspaceFAB({
  vm,
  mobileStickyReserve,
}: {
  vm: ContestDetailViewModel;
  mobileStickyReserve?: boolean;
}) {
  const { contest, translate, navigate } = vm;

  const workspaceHref = contest.slug?.trim()
    ? `/hackathons/${contest.slug.trim()}/manage/overview`
    : "/hackathons/manage";

  return (
    <Button
      type="button"
      size="lg"
      aria-label={translate("detail.workspaceFab.label")}
      className={cn(
        "fixed right-4 z-50 h-12 rounded-full shadow-lg md:right-6",
        mobileStickyReserve ? "bottom-24 md:bottom-6" : "bottom-6",
      )}
      onClick={() => navigate(workspaceHref)}
    >
      <Settings className="size-4" aria-hidden />
      <span className="max-w-[140px] truncate sm:max-w-none">
        {translate("detail.workspaceFab.label")}
      </span>
    </Button>
  );
}
