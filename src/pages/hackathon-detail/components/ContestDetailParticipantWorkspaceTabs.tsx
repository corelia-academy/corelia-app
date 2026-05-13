import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { isNavigationReload } from "@/pages/hackathon-detail/utils/isNavigationReload";
import { ContestDetailParticipantApplicationCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantApplicationCard";
import { ContestDetailParticipantSubmissionCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantSubmissionCard";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

type ParticipantWorkspaceTab = "application" | "submission";

function scrollParticipantWorkspaceIntoView() {
  window.requestAnimationFrame(() => {
    document.getElementById("participant-workspace")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function computeInitialTab(approved: boolean): ParticipantWorkspaceTab {
  const raw =
    typeof window !== "undefined"
      ? window.location.hash.replace(/^#/, "").trim()
      : "";
  if (raw === "participant-submission" && approved) return "submission";
  if (raw === "participant-workspace") return "application";
  return approved ? "submission" : "application";
}

export function ContestDetailParticipantWorkspaceTabs({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const { translate, registration } = vm;
  const location = useLocation();
  const approved = registration?.status === "approved";

  const [tab, setTab] = useState<ParticipantWorkspaceTab>(() =>
    computeInitialTab(approved),
  );

  const prevApprovedRef = useRef<boolean | null>(null);

  const suppressSubmissionScrollOnReloadRef = useRef(false);
  if (
    !suppressSubmissionScrollOnReloadRef.current &&
    typeof window !== "undefined"
  ) {
    const raw = window.location.hash.replace(/^#/, "").trim();
    suppressSubmissionScrollOnReloadRef.current =
      raw === "participant-submission" && isNavigationReload();
  }

  useLayoutEffect(() => {
    const raw = location.hash.replace(/^#/, "").trim();
    if (raw === "participant-submission" && approved) {
      setTab("submission");
    } else if (raw === "participant-workspace") {
      setTab("application");
    }
  }, [location.hash, approved]);

  useEffect(() => {
    if (prevApprovedRef.current === null) {
      prevApprovedRef.current = approved;
      return;
    }
    if (approved && !prevApprovedRef.current) {
      setTab("submission");
    }
    prevApprovedRef.current = approved;
  }, [approved]);

  useEffect(() => {
    if (!approved && tab === "submission") {
      setTab("application");
    }
  }, [approved, tab]);

  useEffect(() => {
    const raw = location.hash.replace(/^#/, "").trim();
    if (raw !== "participant-submission" || !approved || tab !== "submission") {
      return;
    }
    if (suppressSubmissionScrollOnReloadRef.current) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      document.getElementById("participant-submission")?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.hash, approved, tab]);

  const submissionDisabledHint = translate(
    "detail.participant.tabSubmissionDisabledHint",
  );

  return (
    <Card id="participant-workspace" className="scroll-mt-28 sm:scroll-mt-32">
      <CardContent className="px-4 pt-2 pb-0">
        <nav
          className="-mx-1 border-b border-border-subtle"
          aria-label={translate("detail.participant.workspaceTabsAriaLabel")}
        >
          <div
            className="-mb-px flex gap-0 overflow-x-auto overscroll-x-contain px-1 pb-px [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "application"}
              id="participant-tab-application"
              aria-controls="participant-panel-application"
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                tab === "application"
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
              )}
              onClick={() => {
                setTab("application");
                scrollParticipantWorkspaceIntoView();
              }}
            >
              {translate("detail.participant.tabApplication")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "submission"}
              id="participant-tab-submission"
              aria-controls="participant-panel-submission"
              disabled={!approved}
              title={!approved ? submissionDisabledHint : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                tab === "submission"
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
                !approved && "opacity-45",
              )}
              onClick={() => {
                if (!approved) return;
                setTab("submission");
                scrollParticipantWorkspaceIntoView();
              }}
            >
              {translate("detail.participant.tabSubmission")}
            </button>
          </div>
        </nav>

        <div
          id="participant-panel-application"
          role="tabpanel"
          aria-labelledby="participant-tab-application"
          hidden={tab !== "application"}
        >
          <ContestDetailParticipantApplicationCard vm={vm} embedded />
        </div>
        <div
          id="participant-panel-submission"
          role="tabpanel"
          aria-labelledby="participant-tab-submission"
          hidden={tab !== "submission"}
        >
          <div id="participant-submission">
            <ContestDetailParticipantSubmissionCard vm={vm} embedded />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
