import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailApplicationsPanel({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    isManageView,
    canReview,
    activeManageSection,
    handleRefreshMetrics,
    refreshingMetrics,
    registrations,
    registrationStatusLabel,
    savingReviewId,
    handleReview,
    reviewNotes,
    setReviewNotes,
  } = vm;

  if (
    !isManageView ||
    !canReview ||
    activeManageSection !== "applications"
  ) {
    return null;
  }

  return (
    <Card id="applications">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {translate("workspace.manage.applicationsReviewTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {translate("workspace.manage.applicationsReviewDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefreshMetrics()}
          >
            {refreshingMetrics
              ? translate("detail.labels.refreshing")
              : translate("detail.labels.refreshMetrics")}
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {registrations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Users
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {translate("workspace.manage.applicationsEmptyTitle")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {translate("workspace.manage.applicationsEmptyHint")}
                </p>
              </div>
            </div>
          ) : (
            registrations.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border-subtle bg-background p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {registrationStatusLabel(item.status)}
                    </div>
                    <div className="mt-1 text-lg font-medium text-foreground">
                      {item.user_full_name || item.user_id}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.team_name ||
                        translate("detail.labels.defaultSoloRegistration")}
                    </div>
                    {item.team_members.length > 0 && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {translate("workspace.manage.teamMembersPrefix")}{" "}
                        {item.team_members.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        item.status === "approved" ? "default" : "outline"
                      }
                      disabled={savingReviewId === item.user_id}
                      onClick={() =>
                        void handleReview(item.user_id, "approved")
                      }
                    >
                      {translate("workspace.manage.approve")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        item.status === "rejected"
                          ? "destructive"
                          : "outline"
                      }
                      disabled={savingReviewId === item.user_id}
                      onClick={() =>
                        void handleReview(item.user_id, "rejected")
                      }
                    >
                      {translate("workspace.manage.reject")}
                    </Button>
                  </div>
                </div>

                {item.motivation && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {item.motivation}
                  </p>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {translate("detail.labels.contact")}
                    </span>{" "}
                    {item.contact_email ||
                      translate("detail.labels.notProvided")}{" "}
                    ·{" "}
                    {item.contact_phone ||
                      translate("detail.labels.noDataDash")}
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {translate("workspace.manage.portfolioLabel")}
                    </span>{" "}
                    {item.portfolio_url ||
                      translate("detail.labels.notProvided")}
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={`review-note-${item.user_id}`}
                    className="text-sm font-medium text-foreground"
                  >
                    {translate("workspace.manage.reviewNoteLabel")}
                  </label>
                  <textarea
                    id={`review-note-${item.user_id}`}
                    rows={3}
                    value={reviewNotes[item.user_id] ?? ""}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({
                        ...prev,
                        [item.user_id]: e.target.value,
                      }))
                    }
                    className="mt-2 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
