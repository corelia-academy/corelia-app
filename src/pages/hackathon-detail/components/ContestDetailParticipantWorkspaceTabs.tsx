import { ContestDetailParticipantApplicationCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantApplicationCard";
import { ContestDetailParticipantSubmissionCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantSubmissionCard";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

/**
 * Right rail participant card: renders exactly one of application/submission based on the
 * viewer's registration state. The previous nested-tab design duplicated lifecycle hints
 * already shown elsewhere; this gates on registration status so the rail is always actionable.
 */
export function ContestDetailParticipantWorkspaceTabs({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const { registration } = vm;
  const approved = registration?.status === "approved";

  return (
    <Card id="participant-workspace" className="scroll-mt-28 sm:scroll-mt-32">
      <CardContent className="p-4 sm:p-6">
        {approved ? (
          <div id="participant-submission">
            <ContestDetailParticipantSubmissionCard vm={vm} embedded />
          </div>
        ) : (
          <ContestDetailParticipantApplicationCard vm={vm} embedded />
        )}
      </CardContent>
    </Card>
  );
}
