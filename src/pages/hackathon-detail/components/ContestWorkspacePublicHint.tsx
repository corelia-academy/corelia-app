import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { cn } from "@/lib/utils";

/** Slim banner above the hero when the viewer can open the hackathon workspace from the public URL. */
export function ContestWorkspacePublicHint({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const { contest, navigate, translate } = vm;

  const workspaceHref = contest.slug?.trim()
    ? `/hackathons/${contest.slug.trim()}/manage/overview`
    : "/hackathons/manage";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
      )}
      role="region"
      aria-label={translate("detail.workspacePublicHint.ariaLabel")}
    >
      <p className="min-w-0 text-sm leading-snug text-foreground-muted">
        {translate("detail.workspacePublicHint.body")}
      </p>
      <Button
        type="button"
        size="sm"
        className="min-h-9 shrink-0 gap-2 sm:min-h-10"
        onClick={() => navigate(workspaceHref)}
      >
        <Settings className="size-4" aria-hidden />
        {translate("detail.workspaceFab.label")}
      </Button>
    </div>
  );
}
