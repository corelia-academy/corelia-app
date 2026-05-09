import { PageContainer } from "@/components/layouts/PagePrimitives";
import { AdminPreviewBar } from "@/components/hackathons/AdminPreviewBar";
import type { ContestTimelineRow } from "@/components/hackathons/ContestTimeline";
import type { ContestPublicSection } from "@/pages/hackathon-detail/types";
import type { Contest } from "@/types/hackathons";
import { ContestPublicTimelineSection } from "@/pages/hackathon-detail/components/ContestPublicTimelineSection";
import { ContestPublicPrizesSection } from "@/pages/hackathon-detail/components/ContestPublicPrizesSection";
import { ContestPublicRulesSection } from "@/pages/hackathon-detail/components/ContestPublicRulesSection";
import { ContestPublicFaqsSection } from "@/pages/hackathon-detail/components/ContestPublicFaqsSection";
import { ContestPublicProjectsSection } from "@/pages/hackathon-detail/components/ContestPublicProjectsSection";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

type ContestPublicSectionNonOverview = Exclude<ContestPublicSection, "overview">;

export function ContestDetailPublicSectionPage({
  publicSection,
  contest: contestProp,
  translate: translateProp,
  formatDateTime: formatDateTimeProp,
  timelineRows: timelineRowsProp,
  canAccessWorkspace: canAccessWorkspaceProp,
  isManageView: isManageViewProp,
  statusLabel: statusLabelProp,
  embedded = false,
}: {
  publicSection: ContestPublicSectionNonOverview;
  contest?: Contest;
  translate?: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime?: (value: string | null) => string;
  timelineRows?: ContestTimelineRow[];
  canAccessWorkspace?: boolean;
  isManageView?: boolean;
  statusLabel?: (status: Contest["status"]) => string;
  /** When true, skip outer PageContainer (shell already provides width). */
  embedded?: boolean;
}) {
  const vm = useContestDetailVm();
  const contest = contestProp ?? vm.contest;
  const translate = translateProp ?? vm.translate;
  const formatDateTime = formatDateTimeProp ?? vm.formatDateTime;
  const timelineRows = timelineRowsProp ?? vm.timelineRows;
  const canAccessWorkspace = canAccessWorkspaceProp ?? vm.canAccessWorkspace;
  const isManageView = isManageViewProp ?? vm.isManageView;
  const statusLabel = statusLabelProp ?? vm.statusLabel;

  const milestonesCustom = (contest.timeline_milestones ?? []).length > 0;

  const inner = (
    <>
      {!isManageView && canAccessWorkspace ? (
        <AdminPreviewBar
          statusLabel={statusLabel(contest.status)}
          primaryAction={{
            label: translate("previewBar.openWorkspace"),
            to: contest.slug ? `/hackathons/${contest.slug}/manage` : "/hackathons/manage",
          }}
        />
      ) : null}

      {(() => {
        switch (publicSection) {
          case "timeline":
            return (
              <ContestPublicTimelineSection
                contest={contest}
                t={translate}
                milestonesCustom={milestonesCustom}
                timelineRows={timelineRows}
                formatDateTime={formatDateTime}
              />
            );
          case "prizes":
            return <ContestPublicPrizesSection contest={contest} t={translate} />;
          case "rules":
            return <ContestPublicRulesSection contest={contest} t={translate} />;
          case "faqs":
            return <ContestPublicFaqsSection contest={contest} t={translate} />;
          case "projects":
            return <ContestPublicProjectsSection contest={contest} t={translate} />;
          default:
            return null;
        }
      })()}
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{inner}</div>;
  }

  return <PageContainer width="default">{inner}</PageContainer>;
}
