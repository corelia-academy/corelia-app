import { NavLink } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { AdminPreviewBar } from "@/components/contests/AdminPreviewBar";
import type { ContestTimelineRow } from "@/components/contests/ContestTimeline";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import type { Contest } from "@/types/contests";
import { ContestPublicTimelineSection } from "@/pages/contest-detail/components/ContestPublicTimelineSection";
import { ContestPublicPrizesSection } from "@/pages/contest-detail/components/ContestPublicPrizesSection";
import { ContestPublicRulesSection } from "@/pages/contest-detail/components/ContestPublicRulesSection";
import { ContestPublicFaqsSection } from "@/pages/contest-detail/components/ContestPublicFaqsSection";
import { ContestPublicProjectsSection } from "@/pages/contest-detail/components/ContestPublicProjectsSection";

export function ContestDetailPublicSectionPage({
  contest,
  publicSection,
  translate,
  formatDateTime,
  timelineRows,
  canAccessWorkspace,
  isManageView,
  statusLabel,
}: {
  contest: Contest;
  publicSection: Exclude<ContestPublicSection, "overview">;
  translate: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime: (value: string | null) => string;
  timelineRows: ContestTimelineRow[];
  canAccessWorkspace: boolean;
  isManageView: boolean;
  statusLabel: (status: Contest["status"]) => string;
}) {
  const milestonesCustom = (contest.timeline_milestones ?? []).length > 0;

  return (
    <PageContainer>
      <div className="mb-4">
        <Button
          render={<NavLink to={`/contests/${contest.id}/overview`} />}
          nativeButton={false}
          variant="ghost"
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {translate("detail.hero.backToOverview")}
        </Button>
      </div>
      {!isManageView && canAccessWorkspace ? (
        <AdminPreviewBar
          statusLabel={statusLabel(contest.status)}
          primaryAction={{
            label: translate("previewBar.openWorkspace"),
            to: `/admin/contests/${contest.id}/manage`,
          }}
        />
      ) : null}

      {publicSection === "timeline" ? (
        <ContestPublicTimelineSection
          contest={contest}
          t={translate}
          milestonesCustom={milestonesCustom}
          timelineRows={timelineRows}
          formatDateTime={formatDateTime}
        />
      ) : null}

      {publicSection === "prizes" ? (
        <ContestPublicPrizesSection contest={contest} t={translate} />
      ) : null}

      {publicSection === "rules" ? (
        <ContestPublicRulesSection contest={contest} t={translate} />
      ) : null}

      {publicSection === "faqs" ? (
        <ContestPublicFaqsSection contest={contest} t={translate} />
      ) : null}

      {publicSection === "projects" ? (
        <ContestPublicProjectsSection contest={contest} t={translate} />
      ) : null}
    </PageContainer>
  );
}
